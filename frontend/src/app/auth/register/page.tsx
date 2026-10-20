"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Field, FormError, SubmitButton } from "@/components/ui/form-controls";
import { authApi } from "@/lib/auth/api";
import { applyApiErrors } from "@/lib/auth/errors";

const schema = z.object({ first_name: z.string().min(2, "Укажите имя"), last_name: z.string().min(2, "Укажите фамилию"), email: z.email("Введите корректный email"), phone_number: z.string().min(7, "Введите номер телефона"), password: z.string().min(8, "Минимум 8 символов"), password_confirm: z.string().min(1, "Повторите пароль") }).refine(v => v.password === v.password_confirm, { path: ["password_confirm"], message: "Пароли не совпадают" });
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { first_name: "", last_name: "", email: "", phone_number: "", password: "", password_confirm: "" } });
  const mutation = useMutation({ mutationFn: authApi.register, onSuccess: (_, values) => router.push(`/auth/verify-email?email=${encodeURIComponent(values.email)}`), onError: error => applyApiErrors(error, form.setError) });
  const { errors } = form.formState;
  return <div className="auth-content register-content page-enter"><AuthHeading label="Новый профиль" title={<>Ваша история<br /><em>начинается здесь.</em></>}>Сохраняйте избранное и оформляйте заказы быстрее.</AuthHeading><form onSubmit={form.handleSubmit(v => mutation.mutate(v))} noValidate><div className="name-grid"><Field id="first_name" label="Имя" autoComplete="given-name" placeholder="Саид" error={errors.first_name?.message} {...form.register("first_name")} /><Field id="last_name" label="Фамилия" autoComplete="family-name" placeholder="Рахмонов" error={errors.last_name?.message} {...form.register("last_name")} /></div><div className="field-stack compact"><Field id="email" label="Email" type="email" autoComplete="email" placeholder="name@example.com" error={errors.email?.message} {...form.register("email")} /><Field id="phone_number" label="Телефон" type="tel" autoComplete="tel" placeholder="+992 00 000 00 00" error={errors.phone_number?.message} {...form.register("phone_number")} /><Field id="password" label="Пароль" type="password" autoComplete="new-password" placeholder="Не менее 8 символов" error={errors.password?.message} {...form.register("password")} /><Field id="password_confirm" label="Повторите пароль" type="password" autoComplete="new-password" placeholder="Повторите пароль" error={errors.password_confirm?.message} {...form.register("password_confirm")} /></div><p className="terms">Создавая аккаунт, вы принимаете условия использования и политику конфиденциальности.</p><FormError message={errors.root?.message} /><SubmitButton pending={mutation.isPending}>Создать аккаунт</SubmitButton></form><p className="auth-switch">Уже есть аккаунт? <Link href="/auth/login">Войти</Link></p></div>;
}
