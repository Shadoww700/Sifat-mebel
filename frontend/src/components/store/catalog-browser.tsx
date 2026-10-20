"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import type { Catalog } from "@/lib/commerce/models";
import {
  BrowseFilters,
  filterProducts,
  attributeFacets,
} from "@/lib/commerce/browse";
import { browseParams } from "@/lib/commerce/search-params";
import { ProductCard } from "./product-card";
import {
  CollectionPreview,
  DemoNotice,
  EmptyState,
  SectionHeading,
} from "./primitives";
import { Drawer } from "./drawer";
import { Icon } from "./icons";
import { CatalogStatus } from "./catalog-status";
import { Pagination } from "./pagination";

export function CatalogBrowser({
  catalog,
  initial,
  title = "Каталог",
  search = false,
  lockedCategory = false,
}: {
  catalog: Catalog;
  initial: BrowseFilters;
  title?: string;
  search?: boolean;
  lockedCategory?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const server = catalog.source === "api";
  const [prices, setPrices] = useState({ min: initial.min, max: initial.max });
  const filters = server
    ? {
        ...initial,
        type: "",
        available: false,
        attributes: {},
        sort: ["featured", "price-asc", "price-desc", "oldest"].includes(
          initial.sort,
        )
          ? initial.sort
          : "featured",
      }
    : {
        ...browseParams(Object.fromEntries(params)),
        ...(lockedCategory ? { category: initial.category } : {}),
      };
  const products = server
    ? catalog.products
    : filterProducts(catalog.products, filters);
  const facets = server ? [] : attributeFacets(catalog.products, filters);
  const change = (next: Partial<BrowseFilters>) => {
    const state = { ...filters, ...next };
    const params = new URLSearchParams();
    Object.entries(state).forEach(([key, value]) => {
      if (key === "attributes") return;
      if (value && !(key === "sort" && value === "featured"))
        params.set(key === "query" ? "q" : key, String(value));
    });
    Object.entries(state.attributes).forEach(([id, value]) => {
      if (value) params.set(`attr.${id}`, value);
    });
    if (server) {
      // A filter commit starts at page 1 and asks Django, not the current page's array.
      params.delete("page");
      params.delete("type");
      params.delete("available");
      [...params.keys()]
        .filter((key) => key.startsWith("attr."))
        .forEach((key) => params.delete(key));
      startTransition(() =>
        router.push(`${pathname}${params.size ? `?${params}` : ""}`, {
          scroll: false,
        }),
      );
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${pathname}${params.size ? `?${params}` : ""}`,
    );
  };
  const reset = () =>
    change({
      type: "",
      category: lockedCategory ? initial.category : "",
      brand: "",
      min: "",
      max: "",
      available: false,
      attributes: {},
    });
  const active =
    [
      filters.type,
      filters.brand,
      filters.min,
      filters.max,
      filters.available,
      !lockedCategory && filters.category,
    ].filter(Boolean).length +
    Object.values(filters.attributes).filter(Boolean).length;
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.category && !lockedCategory)
    chips.push({
      key: "category",
      label:
        catalog.categories.find((c) => c.id === filters.category)?.name ??
        "Категория",
      clear: () => change({ category: "", type: "", attributes: {} }),
    });
  if (filters.type)
    chips.push({
      key: "type",
      label:
        catalog.types.find((t) => t.id === filters.type)?.name ?? "Тип товара",
      clear: () => change({ type: "", attributes: {} }),
    });
  if (filters.brand)
    chips.push({
      key: "brand",
      label: server
        ? (catalog.brands?.find((b) => b.id === filters.brand)?.name ?? "Бренд")
        : filters.brand,
      clear: () => change({ brand: "" }),
    });
  if (filters.min)
    chips.push({
      key: "min",
      label: `От ${filters.min}`,
      clear: () => change({ min: "" }),
    });
  if (filters.max)
    chips.push({
      key: "max",
      label: `До ${filters.max}`,
      clear: () => change({ max: "" }),
    });
  if (filters.available)
    chips.push({
      key: "stock",
      label: "В наличии",
      clear: () => change({ available: false }),
    });
  for (const [id, value] of Object.entries(filters.attributes)) {
    if (!value) continue;
    const facet = facets.find((f) => f.id === id);
    chips.push({
      key: `attribute-${id}`,
      label: `${facet?.name ?? "Характеристика"}: ${facet?.options.find((o) => o.value === value)?.label ?? value}`,
      clear: () => {
        const attributes = { ...filters.attributes };
        delete attributes[id];
        change({ attributes });
      },
    });
  }
  const form = (prefix: string) => (
    <div className="s-filter-fields">
      <label htmlFor={`${prefix}-category`}>
        Категория
        <select
          id={`${prefix}-category`}
          value={filters.category}
          disabled={lockedCategory}
          onChange={(e) =>
            change({ category: e.target.value, type: "", attributes: {} })
          }
        >
          <option value="">Все категории</option>
          {catalog.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {!server && (
        <label htmlFor={`${prefix}-type`}>
          Тип товара
          <select
            id={`${prefix}-type`}
            value={filters.type}
            onChange={(e) => change({ type: e.target.value, attributes: {} })}
          >
            <option value="">Все предметы</option>
            {catalog.types
              .filter(
                (t) => !filters.category || t.categoryId === filters.category,
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <label htmlFor={`${prefix}-brand`}>
        Бренд
        <select
          id={`${prefix}-brand`}
          value={filters.brand}
          onChange={(e) => change({ brand: e.target.value })}
        >
          <option value="">Все бренды</option>
          {server
            ? catalog.brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))
            : Array.from(new Set(catalog.products.map((p) => p.brand)))
                .filter(Boolean)
                .map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      {facets.length > 0 && (
        <details
          className="s-filter-details"
          open={Boolean(
            filters.type || Object.values(filters.attributes).some(Boolean),
          )}
        >
          <summary>
            Характеристики <Icon name="plus" />
          </summary>
          {!filters.type && (
            <p className="s-muted">
              Выберите тип товара, чтобы сузить набор характеристик.
            </p>
          )}
          <fieldset className="s-attribute-filters">
            <legend className="s-visually-hidden">Детали предмета</legend>
            {facets.map((facet) => (
              <label key={facet.id} htmlFor={`${prefix}-attribute-${facet.id}`}>
                {facet.name}
                <select
                  id={`${prefix}-attribute-${facet.id}`}
                  value={filters.attributes[facet.id] ?? ""}
                  onChange={(event) =>
                    change({
                      attributes: {
                        ...filters.attributes,
                        [facet.id]: event.target.value,
                      },
                    })
                  }
                >
                  <option value="">Любое значение</option>
                  {facet.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
        </details>
      )}
      <fieldset>
        <legend>{server ? "Базовая цена, сомони" : "Цена, сомони"}</legend>
        <div className="s-price-inputs">
          <label>
            <span className="s-visually-hidden">Минимальная цена</span>
            <input
              aria-label="Цена от"
              type="number"
              min="0"
              placeholder="От"
              value={server ? prices.min : filters.min}
              onChange={(e) =>
                server
                  ? setPrices((old) => ({ ...old, min: e.target.value }))
                  : change({ min: e.target.value })
              }
            />
          </label>
          <label>
            <span className="s-visually-hidden">Максимальная цена</span>
            <input
              aria-label="Цена до"
              type="number"
              min="0"
              placeholder="До"
              value={server ? prices.max : filters.max}
              onChange={(e) =>
                server
                  ? setPrices((old) => ({ ...old, max: e.target.value }))
                  : change({ max: e.target.value })
              }
            />
          </label>
        </div>
        {server && (
          <button
            type="button"
            className="s-text-button"
            disabled={pending}
            onClick={() => change(prices)}
          >
            Применить цену
          </button>
        )}
      </fieldset>
      {!server && (
        <label className="s-check">
          <input
            type="checkbox"
            checked={filters.available}
            onChange={(e) => change({ available: e.target.checked })}
          />
          Только в наличии
        </label>
      )}
      {server && (
        <p className="s-muted">
          Поиск, категория, бренд и базовая цена — через API. Фильтры по типу,
          характеристикам и остаткам пока не поддерживаются сервером.
        </p>
      )}
      <button className="s-text-button" type="button" onClick={reset}>
        Сбросить фильтры
      </button>
    </div>
  );
  return (
    <div className="s-browse-view">
      <SectionHeading
        eyebrow={search ? "Найдите своё" : "Предметы и детали"}
        title={
          search
            ? filters.query
              ? `Поиск: «${filters.query}»`
              : "Поиск товаров"
            : title
        }
        text={
          search
            ? server
              ? "По названию, краткому описанию, бренду или типу товара."
              : "По названию, бренду или материалу."
            : server
              ? "Выберите категорию или найдите нужный товар."
              : "Выберите тип товара или найдите нужный предмет."
        }
      />
      <CatalogStatus issues={catalog.issues} />
      {
        <form
          className="s-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            change({ query: String(data.get("q") ?? "") });
          }}
        >
          <label className="s-visually-hidden" htmlFor="catalog-search">
            Поиск по коллекции
          </label>
          <Icon name="search" />
          <input
            id="catalog-search"
            name="q"
            key={filters.query}
            defaultValue={filters.query}
            placeholder="Кресло, диван, орех…"
            type="search"
          />
          <button className="s-button" type="submit">
            Найти
          </button>
        </form>
      }
      {!server && (
        <div className="s-type-tabs" aria-label="Тип товара">
          <button
            onClick={() => change({ type: "", attributes: {} })}
            aria-pressed={!filters.type}
          >
            Все предметы
          </button>
          {catalog.types
            .filter(
              (t) => !filters.category || t.categoryId === filters.category,
            )
            .map((t) => (
              <button
                key={t.id}
                onClick={() => change({ type: t.id, attributes: {} })}
                aria-pressed={filters.type === t.id}
              >
                {t.name}
              </button>
            ))}
        </div>
      )}
      <div className="s-catalog-toolbar">
        <button className="s-filter-toggle" onClick={() => setOpen(true)}>
          <Icon name="filter" />
          Фильтры{active > 0 && <span>{active}</span>}
        </button>
        <span className="s-result-count" role="status">
          {pending
            ? "Загружаем товары…"
            : `Найдено: ${catalog.pagination?.count ?? products.length}`}
        </span>
        <label className="s-sort">
          Порядок
          <select
            aria-label="Сортировка товаров"
            value={filters.sort}
            onChange={(e) => change({ sort: e.target.value })}
          >
            <option value="featured">
              {server ? "Сначала новые" : "По умолчанию"}
            </option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
            {server ? (
              <option value="oldest">Сначала старые</option>
            ) : (
              <option value="name">По названию</option>
            )}
          </select>
        </label>
      </div>
      <div className="s-catalog-layout">
        <aside className="s-filter-sidebar" aria-label="Фильтры товаров">
          <h2>Подобрать предмет</h2>
          {form("desktop")}
        </aside>
        <div className="s-catalog-results" aria-busy={pending}>
          {active > 0 && (
            <div className="s-active-filters">
              <span>Фильтров: {active}</span>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="s-filter-chip"
                  aria-label={`Убрать фильтр: ${chip.label}`}
                  onClick={chip.clear}
                >
                  {chip.label}
                  <Icon name="close" />
                </button>
              ))}
              <button className="s-text-button" onClick={reset}>
                Сбросить
                <Icon name="close" />
              </button>
            </div>
          )}
          {products.length ? (
            <div className="s-product-grid catalog-grid">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 3} />
              ))}
            </div>
          ) : catalog.products.length === 0 && !filters.query && !active ? (
            <div className="s-empty-catalog">
              <EmptyState
                title="Коллекция скоро появится"
                text="В каталоге пока нет опубликованных товаров. Здесь появятся предметы, добавленные в магазин."
                href="/categories"
                action="Посмотреть пространства"
              />
              <CollectionPreview />
            </div>
          ) : (
            <EmptyState
              icon="search"
              title="Пока ничего не нашлось"
              text="Попробуйте другой запрос или измените фильтры."
            >
              <button
                className="s-button"
                onClick={() => {
                  change({
                    ...initial,
                    query: "",
                    category: lockedCategory ? initial.category : "",
                    type: "",
                    brand: "",
                    min: "",
                    max: "",
                    available: false,
                    attributes: {},
                  });
                }}
              >
                Показать все предметы
                <Icon name="arrow" />
              </button>
            </EmptyState>
          )}
          {catalog.pagination && <Pagination {...catalog.pagination} />}
          {catalog.source === "demo" && <DemoNotice />}
          <p className="s-catalog-end">
            {catalog.pagination && catalog.pagination.pages > 1
              ? `Показано ${products.length} товаров на этой странице.`
              : products.length > 0
                ? "Вы посмотрели все предметы этой подборки."
                : ""}{" "}
            <Link href="/categories">Посмотреть пространства →</Link>
          </p>
        </div>
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Подобрать предмет"
      >
        {form("mobile")}
        <button className="s-button s-full" onClick={() => setOpen(false)}>
          Показать: {products.length}
          <Icon name="arrow" />
        </button>
      </Drawer>
    </div>
  );
}
