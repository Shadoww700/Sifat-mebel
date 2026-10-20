"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  accountApi,
  type Address,
  type AddressPayload,
} from "@/lib/account/api";
import { applyApiErrors, getApiErrorMessage } from "@/lib/auth/errors";
import { Field, FormError } from "@/components/ui/form-controls";
import { SectionHeading, EmptyState } from "./primitives";
import { SessionGate } from "./account-shell";
import { Drawer } from "./drawer";
import { Icon } from "./icons";
import { useToast } from "./store-provider";

const required = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Заполните поле")
    .max(max, `Не более ${max} символов`);
const schema = z.object({
  title: required(100),
  recipient_name: required(255),
  phone_number: required(30),
  country: required(100),
  region: required(100),
  city: required(100),
  district: z.string().trim().max(100),
  street: required(255),
  house: required(50),
  apartment: z.string().trim().max(50),
  landmark: z.string().trim().max(255),
  postal_code: z.string().trim().max(20),
  is_default: z.boolean(),
});
const initial: AddressPayload = {
  title: "Дом",
  recipient_name: "",
  phone_number: "",
  country: "Таджикистан",
  region: "Душанбе",
  city: "Душанбе",
  district: "",
  street: "",
  house: "",
  apartment: "",
  landmark: "",
  postal_code: "",
  is_default: false,
};
const fields: {
  key: Exclude<keyof AddressPayload, "is_default">;
  label: string;
  autoComplete?: string;
}[] = [
  { key: "title", label: "Название адреса" },
  { key: "recipient_name", label: "Получатель", autoComplete: "name" },
  { key: "phone_number", label: "Телефон", autoComplete: "tel" },
  { key: "country", label: "Страна", autoComplete: "country-name" },
  { key: "region", label: "Регион", autoComplete: "address-level1" },
  { key: "city", label: "Город", autoComplete: "address-level2" },
  { key: "district", label: "Район · необязательно" },
  { key: "street", label: "Улица", autoComplete: "address-line1" },
  { key: "house", label: "Дом" },
  { key: "apartment", label: "Квартира · необязательно" },
  { key: "landmark", label: "Ориентир · необязательно" },
  {
    key: "postal_code",
    label: "Индекс · необязательно",
    autoComplete: "postal-code",
  },
];
function AddressForm({
  address,
  onDone,
  userId,
}: {
  address: Address | null;
  onDone: () => void;
  userId: number;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const form = useForm<AddressPayload>({
    resolver: zodResolver(schema),
    defaultValues: address ?? initial,
  });
  const mutation = useMutation({
    mutationFn: (payload: AddressPayload) =>
      address
        ? accountApi.updateAddress({ id: address.id, payload })
        : accountApi.createAddress(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["account", "addresses", userId] });
      toast("Адрес сохранён");
      onDone();
    },
    onError: (error) => applyApiErrors(error, form.setError),
  });
  return (
    <form
      className="s-commerce-form"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <fieldset className="s-plain-fieldset" disabled={mutation.isPending}>
        <div className="s-form-grid">
          {fields.map((field) => (
            <Field
              key={field.key}
              id={`address-${field.key}`}
              label={field.label}
              autoComplete={field.autoComplete}
              type={field.key === "phone_number" ? "tel" : "text"}
              error={form.formState.errors[field.key]?.message}
              {...form.register(field.key)}
            />
          ))}
        </div>
        <label className="s-check">
          <input type="checkbox" {...form.register("is_default")} />
          Основной адрес
        </label>
        <FormError message={form.formState.errors.root?.message} />
        <button
          className="s-button s-full"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Сохраняем…" : "Сохранить адрес"}
          <Icon name="check" />
        </button>
      </fieldset>
    </form>
  );
}
function AddressData({ userId }: { userId: number }) {
  const [editing, setEditing] = useState<Address | null | undefined>();
  const [deleting, setDeleting] = useState<Address | null>(null);
  const client = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["account", "addresses", userId],
    queryFn: accountApi.addresses,
    retry: false,
  });
  const remove = useMutation({
    mutationFn: accountApi.deleteAddress,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["account", "addresses", userId] });
      setDeleting(null);
      toast("Адрес удалён");
    },
  });
  if (query.isPending)
    return (
      <div
        className="s-skeleton s-skeleton-profile"
        role="status"
        aria-label="Загружаем адреса"
      />
    );
  if (query.isError)
    return (
      <EmptyState
        title="Адреса пока недоступны"
        text={getApiErrorMessage(query.error)}
      >
        <button className="s-button" onClick={() => query.refetch()}>
          Повторить
        </button>
      </EmptyState>
    );
  return (
    <>
      <div className="s-form-actions s-address-toolbar">
        <button className="s-button" onClick={() => setEditing(null)}>
          Добавить адрес
          <Icon name="plus" />
        </button>
      </div>
      {query.data.length ? (
        <div className="s-address-grid">
          {query.data.map((address) => (
            <article className="s-address-card" key={address.id}>
              {address.is_default && (
                <span className="s-tag">Основной адрес</span>
              )}
              <h2>{address.title}</h2>
              <p>
                {address.recipient_name} · {address.phone_number}
              </p>
              <p>
                {address.country}, {address.region}, {address.city}
              </p>
              <p>
                {[
                  address.street,
                  `д. ${address.house}`,
                  address.apartment && `кв. ${address.apartment}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {address.landmark && <p>{address.landmark}</p>}
              <div className="s-address-actions">
                <button
                  className="s-text-button"
                  onClick={() => setEditing(address)}
                >
                  Изменить
                </button>
                <button
                  className="s-text-button"
                  onClick={() => {
                    remove.reset();
                    setDeleting(address);
                  }}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="location"
          title="Куда отправимся?"
          text="Сохраните адрес, чтобы не вводить его заново."
        >
          <button className="s-button" onClick={() => setEditing(null)}>
            Добавить первый адрес
            <Icon name="plus" />
          </button>
        </EmptyState>
      )}
      <Drawer
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? "Изменить адрес" : "Новый адрес"}
      >
        {editing !== undefined && (
          <AddressForm
            key={editing?.id ?? "new"}
            userId={userId}
            address={editing}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Drawer>
      <Drawer
        open={!!deleting}
        onClose={() => {
          if (!remove.isPending) setDeleting(null);
        }}
        title="Удалить адрес?"
      >
        <p>Адрес «{deleting?.title}» будет удалён из вашего профиля.</p>
        {remove.isError && (
          <FormError message={getApiErrorMessage(remove.error)} />
        )}
        <div className="s-form-actions">
          <button
            className="s-button"
            disabled={remove.isPending}
            onClick={() => {
              if (deleting) remove.mutate(deleting.id);
            }}
          >
            {remove.isPending ? "Удаляем…" : "Удалить адрес"}
          </button>
          <button
            className="s-button secondary"
            disabled={remove.isPending}
            onClick={() => setDeleting(null)}
          >
            Оставить
          </button>
        </div>
      </Drawer>
    </>
  );
}
export function AddressesScreen() {
  return (
    <>
      <SectionHeading
        eyebrow="Всё на своём месте"
        title="Мои адреса"
        text="Сохранённые адреса для обсуждения доставки с магазином."
      />
      <SessionGate>
        {(user) => <AddressData key={user.id} userId={user.id} />}
      </SessionGate>
    </>
  );
}
