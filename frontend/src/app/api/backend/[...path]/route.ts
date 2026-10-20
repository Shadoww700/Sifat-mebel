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
  if (!text) return { data: {} as Record<string, unknown> };
  try {
    return { data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return {
      data: {
        detail: response.ok
          ? "Некорректный ответ API."
          : "Сервер вернул некорректный ответ.",
      },
    };
  }
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
    const { data } = await responseBody(backendResponse);
    if (!backendResponse.ok) return jsonResponse(data, backendResponse.status);
    const nextResponse = jsonResponse(
      { user: data.user },
      backendResponse.status,
    );
    nextResponse.cookies.set(ACCESS_COOKIE, String(data.access), {
      ...cookieOptions,
      maxAge: 5 * 60,
    });
    nextResponse.cookies.set(REFRESH_COOKIE, String(data.refresh), {
      ...cookieOptions,
      maxAge: 24 * 60 * 60,
    });
    return nextResponse;
  }

  const mayRefresh =
    backendResponse.status === 401 &&
    refresh &&
    route !== "v1/auth/token/refresh";
  if (mayRefresh) {
    try {
      const refreshed = await fetch(
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
      if (refreshed.ok) {
        const tokens = (await refreshed.json()) as {
          access: string;
          refresh?: string;
        };
        backendResponse = await djangoFetch(request, path, tokens.access, body);
        const { data } = await responseBody(backendResponse);
        const nextResponse = jsonResponse(data, backendResponse.status);
        nextResponse.cookies.set(ACCESS_COOKIE, tokens.access, {
          ...cookieOptions,
          maxAge: 5 * 60,
        });
        if (tokens.refresh)
          nextResponse.cookies.set(REFRESH_COOKIE, tokens.refresh, {
            ...cookieOptions,
            maxAge: 24 * 60 * 60,
          });
        if (backendResponse.status === 401) clearSession(nextResponse);
        return nextResponse;
      }
    } catch {
      // The original 401 is returned below and the invalid session is cleared.
    }
    const { data } = await responseBody(backendResponse);
    const expiredResponse = jsonResponse(data, 401);
    clearSession(expiredResponse);
    return expiredResponse;
  }

  const { data } = await responseBody(backendResponse);
  const nextResponse = jsonResponse(data, backendResponse.status);
  if (isLogout || isLogoutAll) clearSession(nextResponse);
  return nextResponse;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
