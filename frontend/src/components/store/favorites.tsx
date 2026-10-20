"use client";
import type { Product } from "@/lib/commerce/models";
import { favoriteKey, useFavorites } from "@/lib/commerce/favorites";
import { ProductCard } from "./product-card";
import { EmptyState, SectionHeading } from "./primitives";
import { ProductSkeletons } from "./primitives";
import { useFavoriteCollection } from "@/lib/commerce/favorites-provider";
export function Favorites({ products }: { products: Product[] }) {
  const favorites = useFavorites();
  const saved = products.filter((p) => favorites.includes(favoriteKey(p)));
  const collection = useFavoriteCollection();
  const unavailable = collection.rows.filter(
    (row) =>
      !products.some(
        (product) =>
          product.source === "api" && Number(product.id) === row.product,
      ),
  );
  return (
    <>
      <SectionHeading
        eyebrow="Сохранено для вас"
        title="Избранное"
        text={"Ваша подборка сохраняется в аккаунте через API магазина."}
      />
      {collection.status === "loading" ? (
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
      ) : saved.length || unavailable.length ? (
        <>
          <p className="s-muted" role="status">
            Предметов в подборке: {saved.length + unavailable.length}
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
        </>
      ) : (
        <EmptyState
          icon="heart"
          title="Оставьте место любимому"
          text="Нажимайте на сердце у понравившихся предметов. Они будут ждать вас здесь."
        />
      )}
    </>
  );
}
