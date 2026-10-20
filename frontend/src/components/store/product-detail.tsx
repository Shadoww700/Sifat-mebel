"use client";
import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/commerce/models";
import { money, productPrice } from "@/lib/commerce/models";
import {
  matchingVariants,
  resolvedAttributes,
  selectionFor,
  variantAxes,
} from "@/lib/commerce/variants";
import { FavoriteButton, ProductCard } from "./product-card";
import { DemoNotice } from "./primitives";
import { Icon } from "./icons";
import { ProductGallery } from "./product-gallery";
import {
  AttributeDisplay,
  AvailabilityBadge,
  PriceDisplay,
} from "./product-facts";
import { VariantSelector } from "./variant-selector";
import { ContactCTA } from "./contact-cta";
import { ProductEditLink } from "@/components/admin/product-edit-link";

export function ProductDetail({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const initial =
    product.variants.find((v) => v.stock !== 0) ?? product.variants[0];
  const [selection, setSelection] = useState(() => selectionFor(initial));
  const [fallbackId, setFallbackId] = useState(initial?.id);
  const definedAxes = variantAxes(product.variants);
  // If structured data is incomplete, allow choosing every SKU explicitly.
  const axes = product.variants.every((v) =>
    definedAxes.every((a) => selectionFor(v)[a.id]),
  )
    ? definedAxes
    : [];
  const matches = matchingVariants(product.variants, selection);
  const complete = axes.every((a) => selection[a.id]);
  const variant = axes.length
    ? complete
      ? (matches.find((v) => v.id === fallbackId) ?? matches[0])
      : undefined
    : product.variants.find((v) => v.id === fallbackId);
  const needsSelection = product.variants.length > 0 && !variant;
  const attributes = resolvedAttributes(product, variant);
  return (
    <>
      <div className="s-product-detail">
        <ProductGallery product={product} />
        <div className="s-product-info">
          <ProductEditLink product={product} />
          <span className="s-kicker">
            {product.brand} /{" "}
            <Link href={`/catalog?type=${product.productType.id}`}>
              {product.productType.name}
            </Link>
          </span>
          <div className="s-product-title">
            <h1>{product.name}</h1>
            <FavoriteButton product={product} />
          </div>
          <div
            aria-live="polite"
            aria-atomic="true"
            className="s-selected-summary"
          >
            <PriceDisplay product={product} variant={variant} detail />
            <AvailabilityBadge
              stock={needsSelection ? null : (variant?.stock ?? product.stock)}
              detailed
            />
            <p className="s-selected-sku">
              Артикул:{" "}
              <strong>
                {needsSelection
                  ? "Выберите исполнение"
                  : (variant?.sku ?? product.sku)}
              </strong>
            </p>
          </div>
          {axes.length > 0 && (
            <VariantSelector
              variants={product.variants}
              selection={selection}
              onChange={setSelection}
            />
          )}
          {/* Incomplete/duplicate backend option data must not make a real SKU unreachable. */}
          {((axes.length === 0 && product.variants.length > 1) ||
            (complete && matches.length > 1 && axes.length > 0)) && (
            <label className="s-variant-fallback">
              Исполнение
              <select
                value={variant?.id ?? ""}
                onChange={(e) => {
                  setFallbackId(e.target.value);
                  const next = product.variants.find(
                    (v) => v.id === e.target.value,
                  );
                  setSelection(selectionFor(next));
                }}
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.sku}
                    {v.stock === 0 ? " · нет в наличии" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needsSelection && (
            <p role="status" className="s-muted">
              Выберите исполнение, чтобы уточнить цену и артикул.
            </p>
          )}
          <div className="s-detail-buy">
            <ContactCTA
              product={product}
              variant={variant}
              disabled={needsSelection}
            />
          </div>
          <p className="s-muted">
            Без онлайн-оплаты. Подбор, наличие и доставку обсудим лично.
          </p>
          {product.description && (
            <details className="s-accordion">
              <summary>
                Описание<span aria-hidden="true">+</span>
              </summary>
              <p className="s-product-description">{product.description}</p>
            </details>
          )}
          <details className="s-accordion" open>
            <summary>
              Характеристики<span aria-hidden="true">+</span>
            </summary>
            <AttributeDisplay attributes={attributes} />
            {(product.country || product.warranty) && (
              <dl className="s-attributes">
                {product.country && (
                  <div>
                    <dt>Страна производства</dt>
                    <dd>{product.country}</dd>
                  </div>
                )}
                {product.warranty && (
                  <div>
                    <dt>Гарантия</dt>
                    <dd>{product.warranty}</dd>
                  </div>
                )}
              </dl>
            )}
          </details>
          <details className="s-accordion">
            <summary>
              Доставка<span aria-hidden="true">+</span>
            </summary>
            <p>{product.delivery}</p>
          </details>
          {product.source === "demo" && <DemoNotice />}
        </div>
      </div>
      <div className="s-mobile-purchase">
        <span>
          <small>{variant?.sku ?? product.name}</small>
          <strong>
            {money(productPrice(product, variant), product.currency)}
          </strong>
        </span>
        <ContactCTA
          product={product}
          variant={variant}
          compact
          disabled={needsSelection}
        />
      </div>
      {related.length > 0 && (
        <section className="s-section">
          <div className="s-section-top">
            <div>
              <span className="s-kicker">Ещё в коллекции</span>
              <h2>В вашем стиле.</h2>
            </div>
            <Link className="s-text-link" href="/catalog">
              В коллекцию
              <Icon name="arrow" />
            </Link>
          </div>
          <div className="s-product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
