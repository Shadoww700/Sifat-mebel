"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SuccessState } from "@/components/auth/success-state";
import { Field, FormError, SubmitButton } from "@/components/ui/form-controls";
import { authApi } from "@/lib/auth/api";
import { applyApiErrors } from "@/lib/auth/errors";

const schema = z.object({ email: z.email("Введите корректный email"), code: z.string().regex(/^\d{6}$/, "Введите шестизначный код"), new_password: z.string().min(8, "Минимум 8 символов"), new_password_confirm: z.string().min(1, "Повторите пароль") }).refine(v => v.new_password === v.new_password_confirm, { path: ["new_password_confirm"], message: "Пароли не совпадают" }); type Values = z.infer<typeof schema>;
function ResetForm() {
  const params = useSearchParams(); const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: params.get("email") ?? "", code: "", new_password: "", new_password_confirm: "" } });
  const mutation = useMutation({ mutationFn: authApi.resetPassword, onError: error => applyApiErrors(error, form.setError) }); const { errors } = form.formState;
  if (mutation.isSuccess) return <SuccessState title="Пароль обновлён." text="Теперь вы можете войти с новым паролем." />;
  return <div className="auth-content reset-content page-enter"><AuthHeading label="Новый пароль" title={<>Создайте новый<br /><em>ключ к профилю.</em></>}>Введите код из письма и задайте новый пароль.</AuthHeading><form onSubmit={form.handleSubmit(v => mutation.mutate(v))} noValidate><div className="field-stack compact"><Field id="email" label="Email" type="email" autoComplete="email" placeholder="name@example.com" error={errors.email?.message} {...form.register("email")} /><Field id="code" label="Код из письма" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" error={errors.code?.message} {...form.register("code")} /><Field id="new_password" label="Новый пароль" type="password" autoComplete="new-password" placeholder="Не менее 8 символов" error={errors.new_password?.message} {...form.register("new_password")} /><Field id="new_password_confirm" label="Повторите пароль" type="password" autoComplete="new-password" placeholder="Повторите пароль" error={errors.new_password_confirm?.message} {...form.register("new_password_confirm")} /></div><p className="password-hint">Не менее 8 символов; пароль не должен быть слишком простым или полностью цифровым.</p><FormError message={errors.root?.message} /><SubmitButton pending={mutation.isPending}>Сохранить пароль</SubmitButton></form><p className="auth-switch"><Link href="/auth/login">← Вернуться ко входу</Link></p></div>;
}
export default function ResetPasswordPage() { return <Suspense fallback={<div className="form-skeleton" />}><ResetForm /></Suspense>; }
