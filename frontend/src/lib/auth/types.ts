export type User = {
  id: number; email: string; phone_number?: string; first_name: string; last_name: string;
  role: string; is_email_verified?: boolean; date_joined?: string; last_login?: string | null;
  created_at?: string; updated_at?: string;
};
export type SessionResponse = { user: User };
export type MessageResponse = { message: string };
export type ApiErrors = Record<string, string | string[]>;

export type RegisterPayload = {
  email: string; phone_number: string; first_name: string; last_name: string;
  password: string; password_confirm: string;
};
export type ResetPayload = { email: string; code: string; new_password: string; new_password_confirm: string };
