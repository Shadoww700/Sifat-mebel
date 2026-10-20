import { apiRequest } from "@/lib/api/client";
import type { MessageResponse, RegisterPayload, ResetPayload, SessionResponse, User } from "./types";

const post = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });

export const authApi = {
  register: (payload: RegisterPayload) => post<RegisterPayload & { id: number; role: string }>("/auth/register", payload),
  verifyEmail: (payload: { email: string; code: string }) => post<MessageResponse>("/auth/email-verify", payload),
  resendVerification: (email: string) => post<MessageResponse>("/auth/resend-verification", { email }),
  login: (payload: { email: string; password: string }) => post<SessionResponse>("/auth/login", payload),
  me: () => apiRequest<User>("/auth/me", { method: "GET", cache: "no-store" }),
  forgotPassword: (email: string) => post<MessageResponse>("/auth/password/forgot", { email }),
  resetPassword: (payload: ResetPayload) => post<MessageResponse>("/auth/password/reset", payload),
  logout: () => post<MessageResponse>("/auth/logout", {}),
  logoutAll: () => post<MessageResponse>("/auth/logout-all", {}),
};
