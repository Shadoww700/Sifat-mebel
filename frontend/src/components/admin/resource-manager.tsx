"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  resources,
  resourceDependencies,
  rowTitle,
  type AdminRow,
  type ResourceKey,
} from "@/lib/admin/resources";
import type { ReferenceData } from "@/lib/admin/forms";
import { Drawer } from "@/components/store/drawer";
import { ProductPhoto } from "@/components/store/product-image";
import { Icon } from "@/components/store/icons";
import { useAdmin } from "./admin-shell";
import { AdminHeading, DataState, fieldLabel, useAdminData } from "./data";
import { ResourceForm } from "./resource-form";

function display(
  row: AdminRow,
  field: string,
  resource: ResourceKey,
  data: ReferenceData,
) {
  const value = row[field];
  const ref =
    resources[resource].fields.find((f) => f.key === field)?.ref ??
    (field === "variant" ? "product-variants" : undefined);
  if (ref) {
    const related = data[ref]?.find((r) => r.id === value);
    return related
      ? `${rowTitle(related)} · #${related.id}`
      : `#${value ?? "—"}`;
  }
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (value === null || value === undefined || value === "") return "—";
  if (field === "created_at") {
    const date = new Date(String(value));
    return Number.isNaN(date.valueOf())
      ? String(value)
      : date.toLocaleString("ru-RU");
  }
  if (field === "operation") return value === "IN" ? "Приход" : "Списание";
  return typeof value === "object" ? "—" : String(value);
}
export function ResourceManager({
  resource,
  productId,
}: {
  resource: ResourceKey;
  productId?: number;
}) {
  const config = resources[resource];
  const query = useAdminData([
    resource,
    ...resourceDependencies(resource),
    ...(productId ? (["products", "product-variants"] as ResourceKey[]) : []),
  ]);
  const { adapter, run, source } = useAdmin();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<AdminRow | "create" | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [deleting, setDeleting] = useState<AdminRow | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  if (query.isPending) return <DataState loading />;
  if (query.isError)
    return <DataState error={query.error} retry={() => query.refetch()} />;
  const data: ReferenceData = productId
    ? {
        ...query.data,
        products: query.data.products?.filter((row) => row.id === productId),
        "product-variants": query.data["product-variants"]?.filter(
          (row) => row.product === productId,
        ),
      }
    : query.data;
  const rows = (query.data[resource] ?? []).filter(
    (row) =>
      (!productId ||
        row.product === productId ||
        (resource === "variant-attribute-values" &&
          data["product-variants"]?.some(
            (variant) => variant.id === row.variant,
          ))) &&
      (!variantFilter || row.variant === Number(variantFilter)) &&
      config.columns
        .map((field) => display(row, field, resource, data))
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(search.toLocaleLowerCase("ru")),
  );
  const remove = async () => {
    if (!deleting || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await run(() => adapter.remove(resource, deleting.id));
      setDeleting(null);
      setNotice(
        resource === "products" ? "Товар архивирован" : "Запись удалена",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось удалить запись",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <>
      <AdminHeading title={config.title} text={config.description}>
        {!config.readOnly &&
          (resource === "products" ? (
            <Link className="s-button" href="/admin/products/new">
              Создать товар
              <Icon name="plus" />
            </Link>
          ) : (
            <button className="s-button" onClick={() => setEditor("create")}>
              Создать {config.singular}
              <Icon name="plus" />
            </button>
          ))}
      </AdminHeading>
      {[
        "attributes",
        "product-type-attributes",
        "product-attribute-values",
        "variant-attribute-values",
      ].includes(resource) &&
        !productId && (
          <div className="a-note">
            <strong>Порядок добавления характеристик</strong>
            <p>
              1. Создайте определение. 2. Привяжите его к типу товара. 3.
              Сохраните значение у товара или варианта. Для варианта включите
              «Опция варианта» в схеме типа. В карточке товара эти шаги доступны
              в одном окне.
            </p>
            <div className="a-actions">
              <Link href="/admin/products" className="s-text-link">
                Открыть карточку товара
              </Link>
              <Link
                href="/admin/product-type-attributes"
                className="s-text-link"
              >
                Привязки к типам
              </Link>
            </div>
          </div>
        )}
      {source === "api" && resource === "categories" && (
        <p className="a-note">
          Текущий GET API возвращает только активные категории, в том числе
          сотрудникам. После деактивации запись может исчезнуть из списка.
        </p>
      )}
      {resource === "product-variants" && (
        <p className="a-note">
          Новый вариант создаётся с остатком 0.{" "}
          <Link href="/admin/stock-adjustments">Поступления и списания →</Link>
        </p>
      )}
      <div className="a-toolbar">
        <label>
          Поиск в загруженных записях
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название, артикул, значение…"
          />
        </label>
        {resource === "stock-movements" && (
          <label>
            Вариант
            <select
              value={variantFilter}
              onChange={(e) => setVariantFilter(e.target.value)}
            >
              <option value="">Все варианты</option>
              {query.data["product-variants"]?.map((v) => (
                <option key={v.id} value={v.id}>
                  {rowTitle(v)} · {String(v.sku)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="s-text-button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Обновить
        </button>
        <span role="status">Записей: {rows.length}</span>
      </div>
      <p className="a-success" role="status">
        {notice}
      </p>
      {rows.length ? (
        <div className="a-table-wrap">
          <table className="a-table">
            <caption className="s-visually-hidden">{config.title}</caption>
            <thead>
              <tr>
                {config.columns.map((field) => (
                  <th key={field} scope="col">
                    {fieldLabel(resource, field)}
                  </th>
                ))}
                {!config.readOnly && <th scope="col">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((field) => (
                    <td key={field} data-label={fieldLabel(resource, field)}>
                      {field === "image" ? (
                        <div className="a-image">
                          <ProductPhoto
                            key={String(row.image)}
                            src={
                              typeof row.image === "string"
                                ? row.image
                                : undefined
                            }
                            alt={String(row.alt_text ?? "Изображение товара")}
                            sizes="96px"
                          />
                        </div>
                      ) : (
                        <span>{display(row, field, resource, data)}</span>
                      )}
                    </td>
                  ))}
                  {!config.readOnly && (
                    <td className="a-row-actions">
                      {resource === "products" && (
                        <Link
                          className="s-text-button"
                          href={`/admin/products/${row.id}`}
                          aria-label={`Карточка управления: ${rowTitle(row)}`}
                        >
                          Открыть товар
                        </Link>
                      )}
                      <button
                        className="s-text-button"
                        aria-label={`Изменить: ${rowTitle(row)}`}
                        onClick={() => setEditor(row)}
                      >
                        Изменить
                      </button>
                      <button
                        className="s-text-button a-danger"
                        aria-label={`${resource === "products" ? "Архивировать" : "Удалить"}: ${rowTitle(row)}`}
                        onClick={() => {
                          setError("");
                          setDeleting(row);
                        }}
                      >
                        {resource === "products" ? "В архив" : "Удалить"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="a-empty">
          <h2>
            {search || variantFilter ? "Ничего не найдено" : "Пока нет записей"}
          </h2>
          <p>
            {config.readOnly
              ? "Здесь появятся проведённые корректировки склада."
              : "Создайте первую запись или измените условия поиска."}
          </p>
        </div>
      )}
      <Drawer
        open={editor !== null}
        onClose={() => {
          if (!editorBusy) setEditor(null);
        }}
        title={`${editor === "create" ? "Создать" : "Изменить"} ${config.singular}`}
      >
        {editor !== null && (
          <ResourceForm
            key={editor === "create" ? "new" : editor.id}
            resource={resource}
            row={editor === "create" ? undefined : editor}
            data={data}
            initialValues={
              productId
                ? {
                    id: 0,
                    product: productId,
                    ...(data["product-variants"]?.length === 1
                      ? { variant: data["product-variants"][0].id }
                      : {}),
                  }
                : undefined
            }
            onBusyChange={setEditorBusy}
            onSaved={() => {
              setEditor(null);
              setNotice("Изменения сохранены");
            }}
          />
        )}
      </Drawer>
      <Drawer
        open={deleting !== null}
        onClose={() => {
          if (!pending) setDeleting(null);
        }}
        title={
          resource === "products" ? "Архивировать товар?" : "Удалить запись?"
        }
      >
        <p>{deleting && rowTitle(deleting)}</p>
        <p>
          {resource === "products"
            ? "Товар станет неактивным. Его связанные данные сохранятся."
            : "Удаление нельзя отменить. Связанные записи могут препятствовать удалению."}
        </p>
        {error && (
          <div className="a-error" role="alert">
            {error}
          </div>
        )}
        <div className="a-actions">
          <button className="s-button" disabled={pending} onClick={remove}>
            {pending ? "Выполняем…" : "Подтвердить"}
          </button>
          <button
            className="s-text-button"
            disabled={pending}
            onClick={() => setDeleting(null)}
          >
            Отмена
          </button>
        </div>
      </Drawer>
    </>
  );
}
