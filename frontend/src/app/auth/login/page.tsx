"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Field, FormError, SubmitButton } from "@/components/ui/form-controls";
import { authApi } from "@/lib/auth/api";
import { applyApiErrors } from "@/lib/auth/errors";
import { ApiError } from "@/lib/api/client";

const schema = z.object({ email: z.email("Введите корректный email"), password: z.string().min(1, "Введите пароль") });
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [needsVerification, setNeedsVerification] = useState(false);
  const { register, handleSubmit, setError, getValues, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const mutation = useMutation({ mutationFn: authApi.login, onMutate: () => setNeedsVerification(false), onSuccess: () => router.replace("/account"), onError: error => { if (error instanceof ApiError && Object.values(error.fields).flat().some(value => value === "Verify first")) setNeedsVerification(true); applyApiErrors(error, setError); } });
  return <div className="auth-content page-enter"><AuthHeading label="Личный кабинет" title={<>С возвращением<br /><em>домой.</em></>}>Войдите, чтобы продолжить покупки и видеть историю заказов.</AuthHeading><form onSubmit={handleSubmit(v => mutation.mutate(v))} noValidate><div className="field-stack"><Field id="email" label="Email" type="email" autoComplete="email" placeholder="name@example.com" error={errors.email?.message} {...register("email")} /><Field id="password" label="Пароль" type="password" autoComplete="current-password" placeholder="Введите пароль" error={errors.password?.message} {...register("password")} /></div><div className="form-aside"><span></span><Link href="/auth/forgot-password">Забыли пароль?</Link></div><FormError message={errors.root?.message} />{needsVerification && <Link className="verification-help" href={`/auth/verify-email?email=${encodeURIComponent(getValues("email"))}`}>Подтвердить email →</Link>}<SubmitButton pending={mutation.isPending}>Войти</SubmitButton></form><p className="auth-switch">Впервые у нас? <Link href="/auth/register">Создать аккаунт</Link></p></div>;
}
