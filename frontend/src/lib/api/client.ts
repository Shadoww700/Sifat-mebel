import type { ApiErrors } from "@/lib/auth/types";

const API_URL = "/api/backend/v1";

export class ApiError extends Error {
  constructor(public status: number, public fields: ApiErrors, message = "Ошибка запроса") { super(message); }
}

async function parse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fields = data && typeof data === "object" ? data as ApiErrors : {};
    const first = Object.values(fields)[0];
    const message = Array.isArray(first) ? first[0] : first;
    throw new ApiError(response.status, fields, typeof message === "string" ? message : "Не удалось выполнить запрос");
  }
  return data;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "same-origin" });
  return parse(response) as Promise<T>;
}
