import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const DJANGO_ORIGIN = process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000";
const ACCESS_COOKIE = "sifat_access";
const REFRESH_COOKIE = "sifat_refresh";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type RouteContext = { params: Promise<{ path: string[] }> };

function backendUrl(request: NextRequest, path: string[]) {
  const suffix = path.join("/") === "v1/catalog/product-image" ? "" : "/";
  const url = new URL(`/api/${path.join("/")}${suffix}`, DJANGO_ORIGIN);
  url.search = request.nextUrl.search;
  return url;
}

async function djangoFetch(
  request: NextRequest,
  path: string[],
  access: string | null,
  body?: string | ArrayBuffer,
) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Accept", "application/json");
  if (access) headers.set("Authorization", `Bearer ${access}`);
  return fetch(backendUrl(request, path), {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD" ? undefined : body,
    cache: "no-store",
  });
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text)
    return { data: {} as Record<string, unknown>, status: response.status };
  try {
    return {
      data: JSON.parse(text) as Record<string, unknown>,
      status: response.status,
    };
  } catch {
    return {
      status: response.ok ? 502 : response.status,
      data: {
        detail: response.ok
          ? "Некорректный ответ API."
          : "Сервер вернул некорректный ответ.",
      },
    };
  }
}

function validToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function jsonResponse(data: unknown, status: number) {
  // Address DELETE returns 204. NextResponse.json cannot carry a 204 body.
  if (status === 204) return new NextResponse(null, { status });
  return NextResponse.json(data, { status });
}

function clearSession(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

function setSession(response: NextResponse, access: string, refresh?: string) {
  response.cookies.set(ACCESS_COOKIE, access, {
    ...cookieOptions,
    maxAge: 5 * 60,
  });
  if (refresh)
    response.cookies.set(REFRESH_COOKIE, refresh, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60,
    });
  return response;
}

async function handler(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  if (path[0] !== "v1")
    return jsonResponse({ detail: "Маршрут не найден." }, 404);
  const route = path.join("/");
  const cookieJar = await cookies();
  const access = cookieJar.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = cookieJar.get(REFRESH_COOKIE)?.value ?? null;
  const requestBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.headers.get("content-type")?.startsWith("multipart/form-data")
        ? await request.arrayBuffer()
        : await request.text();

  const isLogin = route === "v1/auth/login";
  const isMe = route === "v1/auth/me";
  const isLogout = route === "v1/auth/logout";
  const isLogoutAll = route === "v1/auth/logout-all";
  const body = isLogout && refresh ? JSON.stringify({ refresh }) : requestBody;

  // A signed-out visitor has no session to verify. Return the expected state
  // from the frontend boundary instead of producing a noisy Django 401 log.
  if (isMe && !access && !refresh) {
    return jsonResponse(
      { detail: "Authentication credentials were not provided." },
      401,
    );
  }

  if (isLogout && !refresh) {
    const nextResponse = jsonResponse({ message: "Сессия завершена." }, 200);
    clearSession(nextResponse);
    return nextResponse;
  }

  let backendResponse: Response;
  try {
    backendResponse = await djangoFetch(request, path, access, body);
  } catch {
    return jsonResponse(
      { detail: "Сервер временно недоступен. Попробуйте ещё раз." },
      503,
    );
  }

  if (isLogin) {
    const { data, status } = await responseBody(backendResponse);
    if (!backendResponse.ok || status === 502)
      return jsonResponse(data, status);
    if (
      !data ||
      !validToken(data.access) ||
      !validToken(data.refresh) ||
      !data.user ||
      typeof data.user !== "object" ||
      Array.isArray(data.user)
    )
      return jsonResponse(
        { detail: "Некорректный ответ сервиса авторизации." },
        502,
      );
    const nextResponse = jsonResponse(
      { user: data.user },
      backendResponse.status,
    );
    return setSession(nextResponse, data.access, data.refresh);
  }

  const mayRefresh =
    backendResponse.status === 401 &&
    refresh &&
    route !== "v1/auth/token/refresh";
  if (mayRefresh) {
    let refreshed: Response;
    try {
      refreshed = await fetch(
        new URL("/api/v1/auth/token/refresh/", DJANGO_ORIGIN),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ refresh }),
          cache: "no-store",
        },
      );
    } catch {
      // Network/service failure is not evidence of an invalid refresh token.
      return jsonResponse(
        { detail: "Не удалось обновить сессию. Попробуйте позже." },
        503,
      );
    }
    if (refreshed.ok) {
      const { data: tokens, status } = await responseBody(refreshed);
      if (
        status === 502 ||
        !tokens ||
        !validToken(tokens.access) ||
        (tokens.refresh !== undefined && !validToken(tokens.refresh))
      )
        return jsonResponse(
          { detail: "Некорректный ответ сервиса авторизации." },
          502,
        );
      const nextAccess = tokens.access;
      const nextRefresh = validToken(tokens.refresh)
        ? tokens.refresh
        : undefined;
      try {
        // Logout must blacklist the rotated token, not its obsolete predecessor.
        const replayBody =
          isLogout && nextRefresh
            ? JSON.stringify({ refresh: nextRefresh })
            : body;
        backendResponse = await djangoFetch(
          request,
          path,
          nextAccess,
          replayBody,
        );
      } catch {
        // Rotation may have invalidated the old refresh already. Keep the
        // new cookies even if the subsequent business request loses network.
        return setSession(
          jsonResponse(
            { detail: "Сервер временно недоступен. Попробуйте ещё раз." },
            503,
          ),
          nextAccess,
          nextRefresh,
        );
      }
      const { data, status: replayStatus } =
        await responseBody(backendResponse);
      const nextResponse = jsonResponse(data, replayStatus);
      setSession(nextResponse, nextAccess, nextRefresh);
      if (backendResponse.status === 401 || isLogout || isLogoutAll)
        clearSession(nextResponse);
      return nextResponse;
    }
    if (![400, 401].includes(refreshed.status))
      return jsonResponse(
        { detail: "Не удалось обновить сессию. Попробуйте позже." },
        refreshed.status,
      );
    const { data } = await responseBody(backendResponse);
    const expiredResponse = jsonResponse(data, 401);
    clearSession(expiredResponse);
    return expiredResponse;
  }

  const { data, status } = await responseBody(backendResponse);
  const nextResponse = jsonResponse(data, status);
  if (isLogout || isLogoutAll) clearSession(nextResponse);
  return nextResponse;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
