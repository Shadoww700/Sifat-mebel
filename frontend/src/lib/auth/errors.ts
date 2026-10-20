import { ApiError } from "@/lib/api/client";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

const translations: Record<string, string> = {
  "Wrong password or username": "Неверный email или пароль.",
  "Verify first": "Сначала подтвердите адрес электронной почты.",
  "Passwords do not match": "Пароли не совпадают.",
  "Passwords don't match": "Пароли не совпадают.",
  "Wrong verification code": "Неверный код подтверждения.",
  "Not such user": "Пользователь с таким email не найден.",
  "No such user": "Пользователь с таким email не найден.",
  "Not such code": "Активный код подтверждения не найден.",
  "Not any verify code": "Активный код подтверждения не найден.",
  "More than 5 time, send code again": "Слишком много попыток. Запросите новый код.",
  "Too many attempts, Request a new code": "Слишком много попыток. Запросите новый код.",
  "Code expired ! (Code's time Ended!)": "Срок действия кода истёк. Запросите новый.",
  "Code has been expired": "Срок действия кода истёк. Запросите новый.",
  "Invalid reset request": "Не удалось подтвердить запрос на смену пароля.",
};

export function readableApiMessage(value: string | string[]) {
  const raw = Array.isArray(value) ? value.join(" ") : value;
  return translations[raw] ?? raw;
}

export function getApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Нет связи с сервером. Попробуйте ещё раз.";
  const first = Object.values(error.fields)[0];
  return first ? readableApiMessage(first) : readableApiMessage(error.message);
}

export function applyApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (!(error instanceof ApiError)) { setError("root" as Path<T>, { message: "Нет связи с сервером. Попробуйте ещё раз." }); return; }
  let mapped = false;
  Object.entries(error.fields).forEach(([key, value]) => {
    const message = readableApiMessage(value);
    const name = key === "detail" || key === "message" || key === "error" || key === "non_field_errors" ? "root" : key;
    const alias = name === "passwords" ? "new_password" : name;
    setError(alias as Path<T>, { message }); mapped = true;
  });
  if (!mapped) setError("root" as Path<T>, { message: error.message });
}
