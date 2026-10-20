"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resources, type ResourceKey } from "@/lib/admin/resources";
import type { ReferenceData } from "@/lib/admin/forms";
import { useAdmin } from "./admin-shell";
import type { AdminProductPage } from "@/lib/admin/api";

export function useAdminData(
  keys: ResourceKey[],
  options: { page?: number; search?: string; productId?: number } = {},
) {
  const { source, user, adapter } = useAdmin();
  const client = useQueryClient();
  const stableKeys = [...new Set(keys)].sort();
  const query = useQuery({
    queryKey: ["admin-data", source, user.id, ...stableKeys, options],
    retry: false,
    queryFn: async (): Promise<
      ReferenceData & { productPagination?: AdminProductPage }
    > => {
      let productPagination: AdminProductPage | undefined;
      const data = Object.fromEntries(
        await Promise.all(
          stableKeys.map(async (key) => {
            if (key === "products" && source === "api") {
              if (options.productId && adapter.product)
                return [
                  key,
                  [
                    await client.fetchQuery({
                      queryKey: [
                        "admin-data",
                        source,
                        user.id,
                        "product",
                        options.productId,
                      ],
                      queryFn: () => adapter.product!(options.productId!),
                      staleTime: 30_000,
                    }),
                  ],
                ];
              productPagination = await adapter.productPage!(
                options.page ?? 1,
                options.search,
              );
              return [key, productPagination.rows];
            }
            return [
              key,
              await client.fetchQuery({
                queryKey: ["admin-data", source, user.id, "resource", key],
                queryFn: () => adapter.list(key),
                staleTime: 30_000,
              }),
            ];
          }),
        ),
      );
      return { ...data, productPagination };
    },
  });
  return {
    ...query,
    refetch: async () => {
      await client.invalidateQueries({
        queryKey: ["admin-data", source, user.id],
        refetchType: "none",
      });
      return query.refetch();
    },
  };
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
