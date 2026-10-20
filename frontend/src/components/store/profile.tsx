"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { accountApi, type Profile } from "@/lib/account/api";
import { authApi } from "@/lib/auth/api";
import { applyApiErrors, getApiErrorMessage } from "@/lib/auth/errors";
import { Field, FormError } from "@/components/ui/form-controls";
import { SectionHeading, EmptyState } from "./primitives";
import { SessionGate } from "./account-shell";
import { useToast } from "./store-provider";
import { Icon } from "./icons";
import { AdminEntry } from "@/components/admin/admin-entry";

const schema = z.object({
  first_name: z.string().trim().max(150, "Не более 150 символов"),
  last_name: z.string().trim().max(150, "Не более 150 символов"),
  phone_number: z.string().trim().max(20, "Не более 20 символов"),
  birth_date: z
    .string()
    .refine(
      (v) =>
        !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Date.parse(v) <= Date.now()),
      "Укажите дату рождения в прошлом",
    ),
});
type Values = z.infer<typeof schema>;
function ProfileForm({
  profile,
  userId,
}: {
  profile: Profile;
  userId: number;
}) {
  const client = useQueryClient();
  const notify = useToast();
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone_number: profile.phone_number,
      birth_date: profile.birth_date ?? "",
    },
  });
  const save = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: (data) => {
      client.setQueryData(["account", "profile", userId], data);
      client.invalidateQueries({ queryKey: ["auth", "me"] });
      form.reset({
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
        birth_date: data.birth_date ?? "",
      });
      notify("Изменения профиля сохранены");
    },
    onError: (error) => applyApiErrors(error, form.setError),
  });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      client.clear();
      router.replace("/auth/login");
    },
  });
  return (
    <>
      <div className="s-profile-card">
        <span className="s-avatar" aria-hidden="true">
          {(profile.first_name || profile.email).slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>
            {[profile.first_name, profile.last_name]
              .filter(Boolean)
              .join(" ") || "Ваш профиль"}
          </strong>
          <p>{profile.email}</p>
        </div>
      </div>
      <form
        className="s-commerce-form"
        onSubmit={form.handleSubmit((values) =>
          save.mutate({ ...values, birth_date: values.birth_date || null }),
        )}
        noValidate
      >
        <div className="s-form-grid">
          <Field
            id="profile-first"
            label="Имя"
            autoComplete="given-name"
            error={form.formState.errors.first_name?.message}
            {...form.register("first_name")}
          />
          <Field
            id="profile-last"
            label="Фамилия"
            autoComplete="family-name"
            error={form.formState.errors.last_name?.message}
            {...form.register("last_name")}
          />
          <Field
            id="profile-phone"
            label="Телефон"
            type="tel"
            autoComplete="tel"
            error={form.formState.errors.phone_number?.message}
            {...form.register("phone_number")}
          />
          <Field
            id="profile-birth"
            label="Дата рождения · необязательно"
            type="date"
            autoComplete="bday"
            error={form.formState.errors.birth_date?.message}
            {...form.register("birth_date")}
          />
        </div>
        <FormError message={form.formState.errors.root?.message} />
        <div className="s-form-actions">
          <button className="s-button" disabled={save.isPending} type="submit">
            {save.isPending ? "Сохраняем…" : "Сохранить изменения"}
            <Icon name="check" />
          </button>
        </div>
      </form>
      <section className="s-account-security">
        <AdminEntry />
        <h2>Доступ к аккаунту</h2>
        <p className="s-muted">
          Для смены пароля используйте код, отправленный на вашу почту.
        </p>
        <div className="s-form-actions">
          <Link className="s-text-link" href="/auth/forgot-password">
            Восстановить пароль
            <Icon name="arrow" />
          </Link>
          <button
            className="s-text-button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Завершаем сессию…" : "Выйти из аккаунта"}
          </button>
        </div>
        {logout.isError && (
          <FormError message={getApiErrorMessage(logout.error)} />
        )}
      </section>
    </>
  );
}
function ProfileData({ userId }: { userId: number }) {
  const query = useQuery({
    queryKey: ["account", "profile", userId],
    queryFn: accountApi.profile,
    retry: false,
  });
  if (query.isPending)
    return (
      <div
        className="s-skeleton s-skeleton-profile"
        role="status"
        aria-label="Загружаем профиль"
      />
    );
  if (query.isError)
    return (
      <EmptyState
        title="Профиль пока недоступен"
        text={getApiErrorMessage(query.error)}
      >
        <button className="s-button" onClick={() => query.refetch()}>
          Повторить
        </button>
      </EmptyState>
    );
  return <ProfileForm profile={query.data} userId={userId} />;
}
export function ProfileScreen() {
  return (
    <>
      <SectionHeading
        eyebrow="Личное пространство"
        title="С возвращением."
        text="Ваша информация и настройки аккаунта."
      />
      <SessionGate>
        {(user) => <ProfileData key={user.id} userId={user.id} />}
      </SessionGate>
    </>
  );
}
