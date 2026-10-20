"use client";
import type { Product } from "@/lib/commerce/models";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "./pagination";
import { favoriteKey, useFavorites } from "@/lib/commerce/favorites";
import { ProductCard } from "./product-card";
import { EmptyState, SectionHeading } from "./primitives";
import { ProductSkeletons } from "./primitives";
import { useFavoriteCollection } from "@/lib/commerce/favorites-provider";
export function Favorites() {
  const favorites = useFavorites();
  const collection = useFavoriteCollection();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(collection.rows.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = collection.rows.slice(
    (currentPage - 1) * 20,
    currentPage * 20,
  );
  const ids = visible.map((row) => row.product);
  const details = useQuery({
    queryKey: ["favorite-product-details", ids],
    enabled: collection.status === "ready" && ids.length > 0,
    retry: false,
    queryFn: async () => {
      const products: Product[] = [];
      // Favorites API returns IDs only. Hydrate this page, at most four at once;
      // reuse public detail cache, never scan the products collection.
      for (let index = 0; index < ids.length; index += 4) {
        const batch = await Promise.all(
          ids.slice(index, index + 4).map((id) =>
            client.fetchQuery({
              queryKey: ["public-product", id],
              staleTime: 30_000,
              queryFn: async (): Promise<Product | null> => {
                const response = await fetch(`/api/store/products/${id}`);
                if (response.status === 404) return null;
                if (!response.ok)
                  throw new Error(
                    "Не удалось загрузить сохранённые товары. Повторите попытку.",
                  );
                return response.json();
              },
            }),
          ),
        );
        products.push(...batch.filter((p): p is Product => p !== null));
      }
      return products;
    },
  });
  const products = details.data ?? [];
  const saved = products.filter((p) => favorites.includes(favoriteKey(p)));
  const unavailable = visible.filter(
    (row) =>
      !products.some(
        (product) =>
          product.source === "api" && Number(product.id) === row.product,
      ),
  );
  return (
    <div className="s-favorites-view">
      <SectionHeading
        eyebrow="Сохранено для вас"
        title="Избранное"
        text="Соберите понравившиеся предметы в одном месте и вернитесь к выбору позже."
      >
        <Link className="s-text-link" href="/catalog" prefetch={false}>
          Продолжить выбор
        </Link>
      </SectionHeading>
      {collection.status === "loading" ||
      (collection.status === "ready" && ids.length > 0 && details.isPending) ? (
        <ProductSkeletons />
      ) : collection.status === "guest" ? (
        <EmptyState
          icon="user"
          title="Войдите, чтобы открыть избранное"
          text="Сохраняйте товары в аккаунте и возвращайтесь к ним с другого устройства."
          href="/auth/login"
          action="Войти в аккаунт"
        />
      ) : collection.status === "demo" ? (
        <EmptyState
          title="Открыта демонстрационная коллекция"
          text="Демонстрационные товары нельзя сохранить в реальное избранное. Для избранного нужен рабочий каталог Django API; локального сохранения здесь нет."
        />
      ) : collection.status === "error" ? (
        <EmptyState
          title="Не удалось загрузить избранное"
          text={collection.error}
        >
          <button className="s-button" onClick={collection.refresh}>
            Повторить
          </button>
        </EmptyState>
      ) : details.isError && collection.status === "ready" && ids.length > 0 ? (
        <EmptyState
          title="Не удалось загрузить товары"
          text={details.error.message}
        >
          <button className="s-button" onClick={() => void details.refetch()}>
            Повторить
          </button>
        </EmptyState>
      ) : saved.length || unavailable.length ? (
        <>
          <p className="s-muted" role="status">
            Предметов в подборке: {collection.rows.length}
          </p>
          <div className="s-product-grid">
            {saved.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {unavailable.map((row) => (
            <div className="s-empty" key={row.id}>
              <h2>Товар #{row.product} недоступен в каталоге</h2>
              <p>
                Он сохранён в вашем аккаунте, но сейчас не опубликован или
                данные каталога ещё обновляются.
              </p>
              <button
                className="s-text-button"
                disabled={collection.pending.includes(`api:${row.product}`)}
                onClick={() => void collection.remove(row)}
                aria-label={`Удалить недоступный товар #${row.product} из избранного`}
              >
                Удалить из избранного
              </button>
            </div>
          ))}
          <Pagination page={currentPage} pages={pages} onPage={setPage} />
        </>
      ) : (
        <EmptyState
          icon="heart"
          title="Оставьте место любимому"
          text="Нажимайте на сердце у понравившихся предметов. Они будут ждать вас здесь."
        />
      )}
    </div>
  );
}
