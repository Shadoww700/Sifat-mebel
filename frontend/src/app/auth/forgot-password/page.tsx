"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SuccessState } from "@/components/auth/success-state";
import { Field, FormError, SubmitButton } from "@/components/ui/form-controls";
import { authApi } from "@/lib/auth/api";
import { applyApiErrors } from "@/lib/auth/errors";

const schema = z.object({ email: z.email("Введите корректный email") }); type Values = z.infer<typeof schema>;
export default function ForgotPasswordPage() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const mutation = useMutation({ mutationFn: authApi.forgotPassword, onError: error => applyApiErrors(error, form.setError) });
  if (mutation.isSuccess) return <SuccessState eyebrow="Проверьте почту" title="Письмо уже в пути." text="Если аккаунт с таким адресом существует, мы отправили шестизначный код для смены пароля." href={`/auth/reset-password?email=${encodeURIComponent(form.getValues("email"))}`} action="Ввести код" />;
  return <div className="auth-content page-enter"><AuthHeading label="Восстановление" title={<>Вернём доступ<br /><em>к вашему дому.</em></>}>Укажите email аккаунта. Мы отправим код для создания нового пароля.</AuthHeading><form onSubmit={form.handleSubmit(v => mutation.mutate(v.email))} noValidate><Field id="email" label="Email" type="email" autoComplete="email" placeholder="name@example.com" error={form.formState.errors.email?.message} {...form.register("email")} /><FormError message={form.formState.errors.root?.message} /><SubmitButton pending={mutation.isPending}>Отправить код</SubmitButton></form><p className="auth-switch"><Link href="/auth/login">← Вернуться ко входу</Link></p></div>;
}
