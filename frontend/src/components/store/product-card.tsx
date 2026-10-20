"use client";

import Link from "next/link";
import type { Product, Variant } from "@/lib/commerce/models";
import { productHref } from "@/lib/commerce/models";
import { localCommerce } from "@/lib/commerce/local-store";
import { favoriteKey, useFavorites } from "@/lib/commerce/favorites";
import { AvailabilityBadge, PriceDisplay } from "./product-facts";
import { ProductPhoto } from "./product-image";
import { Icon } from "./icons";
import { useToast } from "./store-provider";
import { ProductEditLink } from "@/components/admin/product-edit-link";
import { useFavoriteCollection } from "@/lib/commerce/favorites-provider";

export function FavoriteButton({ product }: { product: Product }) {
  const favorites = useFavorites();
  const collection = useFavoriteCollection();
  const saved = favorites.includes(favoriteKey(product));
  const pending = collection.pending.includes(favoriteKey(product));
  if (collection.status === "guest")
    return (
      <Link
        className="s-icon-button s-favorite"
        href="/auth/login"
        aria-label={`Войти, чтобы сохранить: ${product.name}`}
        title="Войдите, чтобы сохранить товар"
      >
        <Icon name="heart" />
      </Link>
    );
  return (
    <button
      type="button"
      className={`s-icon-button s-favorite ${saved ? "is-saved" : ""}`}
      aria-pressed={saved}
      aria-busy={pending}
      disabled={pending || collection.status !== "ready"}
      title={
        collection.status === "demo"
          ? "Демонстрационный товар нельзя сохранить в реальное избранное."
          : collection.status === "error"
            ? "Избранное недоступно. Повторите загрузку на странице избранного."
            : undefined
      }
      aria-label={`${saved ? "Убрать из избранного" : "В избранное"}: ${product.name}`}
      onClick={() => {
        void collection.toggle(product);
      }}
    >
      <Icon name="heart" />
    </button>
  );
}
export function AddToCart({
  product,
  variant,
  compact = false,
}: {
  product: Product;
  variant?: Variant;
  compact?: boolean;
}) {
  const notify = useToast();
  const available =
    product.available && (variant?.stock ?? product.stock) !== 0;
  return (
    <button
      type="button"
      className={compact ? "s-card-add" : "s-button"}
      disabled={!available}
      onClick={() => {
        localCommerce.add(
          {
            productId: product.id,
            variantId: variant?.id ?? null,
            quantity: 1,
          },
          variant?.stock ?? product.stock ?? 20,
        );
        notify(`${product.name} — в корзине`);
      }}
      aria-label={`${available ? "Добавить в корзину" : "Нет в наличии"}: ${product.name}`}
    >
      <span>
        {available
          ? compact
            ? "В корзину"
            : "Добавить в корзину"
          : "Нет в наличии"}
      </span>
      <Icon name={compact ? "plus" : "bag"} />
    </button>
  );
}
export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  return (
    <article className="s-product-card">
      <div className="s-card-media">
        <Link
          href={productHref(product)}
          prefetch={false}
          aria-label={`Подробнее: ${product.name}`}
        >
          <ProductPhoto
            src={product.images[0]?.src}
            alt={product.images[0]?.alt ?? product.name}
            priority={priority}
            contain
          />
        </Link>
        {product.badge && <span className="s-badge">{product.badge}</span>}
        <FavoriteButton product={product} />
      </div>
      <div className="s-card-meta">
        <span>{product.brand || product.productType.name}</span>
        <AvailabilityBadge stock={product.stock} />
      </div>
      <h3>
        <Link href={productHref(product)} prefetch={false}>
          {product.name}
        </Link>
      </h3>
      <div className="s-card-bottom">
        <PriceDisplay
          product={product}
          variant={
            product.variants.length === 1 ? product.variants[0] : undefined
          }
        />
        <Link
          className="s-card-add"
          href={productHref(product)}
          prefetch={false}
          aria-label={`Подробнее о товаре: ${product.name}`}
        >
          <Icon name="arrow" />
        </Link>
      </div>
      <ProductEditLink product={product} />
    </article>
  );
}
