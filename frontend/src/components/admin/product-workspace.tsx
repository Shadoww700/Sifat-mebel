"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminHeading, DataState, useAdminData } from "./data";
import { ResourceForm } from "./resource-form";
import { ResourceManager } from "./resource-manager";
import type { ResourceKey } from "@/lib/admin/resources";
import { AttributeSetup } from "./attribute-setup";

const sections = [
  { key: "details", label: "Основное" },
  { key: "product-images", label: "Фотографии" },
  { key: "product-variants", label: "Варианты" },
  { key: "product-attribute-values", label: "Характеристики" },
  { key: "variant-attribute-values", label: "Опции вариантов" },
] as const;
type Section = (typeof sections)[number]["key"];

/** One product context; existing forms/adapters remain the only write path. */
export function ProductWorkspace({ productId }: { productId?: number }) {
  const router = useRouter();
  const query = useAdminData(
    [
      "product-types",
      "brands",
      "categories",
      ...(productId
        ? (["products", "product-images", "product-variants"] as ResourceKey[])
        : []),
    ],
    { productId },
  );
  const [section, setSection] = useState<Section>("details");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  if (query.isPending) return <DataState loading />;
  if (query.isError)
    return <DataState error={query.error} retry={() => query.refetch()} />;
  const product = query.data.products?.find((row) => row.id === productId);
  if (productId && !product)
    return (
      <div className="a-empty">
        <h1>Товар не найден</h1>
        <p>Он удалён или недоступен в текущем источнике данных.</p>
        <Link className="s-button" href="/admin/products">
          К товарам
        </Link>
      </div>
    );
  const missing = [
    { key: "categories", label: "Категории" },
    { key: "product-types", label: "Типы товаров" },
    { key: "brands", label: "Бренды" },
  ].filter((item) => !query.data[item.key as ResourceKey]?.length);
  const images =
    query.data["product-images"]?.filter((row) => row.product === productId) ??
    [];
  const variants =
    query.data["product-variants"]?.filter(
      (row) => row.product === productId,
    ) ?? [];
  return (
    <>
      <Link className="s-text-link" href="/admin/products">
        ← Все товары
      </Link>
      <AdminHeading
        title={product ? String(product.name) : "Новый товар"}
        text={
          product
            ? `Артикул ${product.sku} · #${product.id}. Все связанные данные — в одной карточке.`
            : "Сначала сохраните основную информацию. Затем добавьте фотографии, варианты и характеристики здесь же."
        }
      />
      {missing.length > 0 && (
        <div className="a-note">
          <strong>Подготовьте структуру каталога</strong>
          <p>Для товара нужны тип и бренд. Тип товара относится к категории.</p>
          <div className="a-actions">
            {missing.map((item) => (
              <Link
                className="s-text-link"
                key={item.key}
                href={`/admin/${item.key}`}
              >
                {item.label} →
              </Link>
            ))}
          </div>
        </div>
      )}
      {product && (
        <>
          <div className="a-product-progress" aria-label="Подготовка товара">
            <span>
              <strong>
                {product.status === "ACTIVE" && product.is_active
                  ? "Опубликован"
                  : "Не опубликован"}
              </strong>
              <small>Статус: {String(product.status)}</small>
            </span>
            <span>
              <strong>{images.length} фото</strong>
              <small>
                {images.some((row) => row.is_primary)
                  ? "Основное фото выбрано"
                  : "Выберите основное фото"}
              </small>
            </span>
            <span>
              <strong>{variants.length} вариантов</strong>
              <small>Остатки — через журнал склада</small>
            </span>
          </div>
          <p className="a-note">
            Для публикации откройте «Основное», выберите статус ACTIVE и
            включите «Активно». В Demo изменения не публикуются на витрине.{" "}
            <Link href="/admin/stock-adjustments">Перейти к остаткам →</Link>
          </p>
        </>
      )}
      <nav className="a-product-sections" aria-label="Разделы карточки товара">
        {sections.map((item) => (
          <button
            key={item.key}
            className="s-text-button"
            type="button"
            aria-current={section === item.key ? "page" : undefined}
            disabled={busy || (!product && item.key !== "details")}
            onClick={() => {
              setSection(item.key);
              setNotice("");
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p className="a-success" role="status">
        {notice}
      </p>
      {section === "details" ? (
        <section
          className="a-panel a-product-form"
          aria-label="Основная информация товара"
        >
          <h2>
            {product ? "Основная информация" : "Шаг 1 · Основная информация"}
          </h2>
          <ResourceForm
            key={product?.id ?? "new"}
            resource="products"
            row={product}
            data={query.data}
            onBusyChange={setBusy}
            onSaved={(saved) => {
              if (!product) router.replace(`/admin/products/${saved.id}`);
              else
                setNotice(
                  "Информация сохранена. Можно перейти к фото и вариантам.",
                );
            }}
          />
        </section>
      ) : (
        <section
          aria-label={sections.find((item) => item.key === section)?.label}
        >
          {product &&
            (section === "product-attribute-values" ||
              section === "variant-attribute-values") && (
              <AttributeSetup
                key={`${product.id}:${section}`}
                product={product}
                variantMode={section === "variant-attribute-values"}
              />
            )}
          <ResourceManager
            key={`${productId}:${section}`}
            resource={section}
            productId={productId}
          />
        </section>
      )}
    </>
  );
}
