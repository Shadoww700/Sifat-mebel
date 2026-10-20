"use client";
import { useQuery } from "@tanstack/react-query";
import { resources, type ResourceKey } from "@/lib/admin/resources";
import type { ReferenceData } from "@/lib/admin/forms";
import { useAdmin } from "./admin-shell";

export function useAdminData(keys: ResourceKey[]) {
  const { source, user, adapter } = useAdmin();
  const stableKeys = [...new Set(keys)].sort();
  return useQuery({
    queryKey: ["admin-data", source, user.id, ...stableKeys],
    retry: false,
    queryFn: async (): Promise<ReferenceData> =>
      Object.fromEntries(
        await Promise.all(
          stableKeys.map(async (key) => [key, await adapter.list(key)]),
        ),
      ),
  });
}
export function AdminHeading({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="a-heading">
      <div>
        <span className="s-kicker">Рабочее пространство</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
export function DataState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: Error | null;
  retry?: () => void;
}) {
  return loading ? (
    <div
      role="status"
      aria-label="Загружаем данные управления"
      className="a-loading"
    >
      <div className="s-skeleton s-skeleton-line" />
      <div className="s-skeleton a-skeleton" />
    </div>
  ) : (
    <div role="alert" className="a-empty">
      <h2>Не удалось загрузить данные</h2>
      <p>{error?.message ?? "Повторите попытку."}</p>
      <button className="s-button" onClick={retry}>
        Повторить
      </button>
    </div>
  );
}
export const fieldLabel = (key: ResourceKey, field: string) =>
  resources[key].fields.find((f) => f.key === field)?.label ??
  (
    {
      stock_quantity: "Остаток",
      variant: "Вариант",
      operation: "Операция",
      quantity: "Количество",
      reason: "Основание",
      created_at: "Дата",
    } as Record<string, string>
  )[field] ??
  field;
