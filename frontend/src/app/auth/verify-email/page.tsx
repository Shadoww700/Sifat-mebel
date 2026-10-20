"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthHeading } from "@/components/auth/auth-heading";
import { OtpField } from "@/components/auth/otp-field";
import { SuccessState } from "@/components/auth/success-state";
import { Field, FormError, SubmitButton } from "@/components/ui/form-controls";
import { authApi } from "@/lib/auth/api";
import { applyApiErrors, getApiErrorMessage } from "@/lib/auth/errors";

const schema = z.object({
  email: z.string().trim().pipe(z.email("Введите корректный email")),
  code: z.string().regex(/^\d{6}$/, "Введите все шесть цифр кода"),
});
type Values = z.infer<typeof schema>;
function VerifyForm() {
  const params = useSearchParams();
  const [notice, setNotice] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get("email") ?? "", code: "" },
  });
  const verify = useMutation({
    mutationFn: authApi.verifyEmail,
    onError: (error) => applyApiErrors(error, form.setError),
  });
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      form.clearErrors();
      form.setValue("code", "");
      setNotice("Новый код отправлен. Проверьте также папку «Спам».");
    },
    onError: (error) => {
      setNotice("");
      form.setError("root", { message: getApiErrorMessage(error) });
    },
  });
  const busy = verify.isPending || resend.isPending;
  if (verify.isSuccess)
    return (
      <SuccessState
        title="Email подтверждён."
        text="Ваш профиль готов. Войдите и продолжите знакомство с коллекцией."
      />
    );
  const sendAgain = async () => {
    form.clearErrors("root");
    if (await form.trigger("email")) resend.mutate(form.getValues("email"));
  };
  return (
    <div className="auth-content page-enter">
      <AuthHeading
        label="Подтверждение"
        title={
          <>
            Шесть цифр —<br />
            <em>и всё готово.</em>
          </>
        }
      >
        Введите код из письма. Если письма нет, запросите новый код.
      </AuthHeading>
      <form
        onSubmit={form.handleSubmit((values) => {
          setNotice("");
          form.clearErrors("root");
          verify.mutate(values);
        })}
        noValidate
      >
        <div className="otp-email">
          <Field
            id="verify-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            disabled={busy}
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
        </div>
        <Controller
          control={form.control}
          name="code"
          render={({ field, fieldState }) => (
            <OtpField
              value={field.value}
              onChange={field.onChange}
              disabled={busy}
              error={fieldState.error?.message}
            />
          )}
        />
        <FormError message={form.formState.errors.root?.message} />
        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}
        <SubmitButton pending={busy}>Подтвердить email</SubmitButton>
      </form>
      <div className="resend-row">
        <span>Не получили письмо?</span>
        <button type="button" disabled={busy} onClick={sendAgain}>
          {resend.isPending ? "Отправляем…" : "Отправить снова"}
        </button>
      </div>
      <p className="auth-switch">
        <Link href="/auth/login">← Вернуться ко входу</Link>
      </p>
    </div>
  );
}
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="form-skeleton"
          role="status"
          aria-label="Загрузка подтверждения email"
        />
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
