"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/store/drawer";
import { rowTitle, type AdminRow } from "@/lib/admin/resources";
import { DataState, useAdminData } from "./data";
import { ResourceForm } from "./resource-form";

type Stage = "pick" | "definition" | "link" | "value";
/** Three existing API resources, explicitly saved in order (not a fake transaction). */
export function AttributeSetup({
  product,
  variantMode = false,
}: {
  product: AdminRow;
  variantMode?: boolean;
}) {
  const inputId = useId();
  const query = useAdminData(
    [
      "attributes",
      "product-types",
      "product-type-attributes",
      "products",
      "product-variants",
      "product-attribute-values",
      "variant-attribute-values",
    ],
    { productId: product.id },
  );
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("pick");
  const [attributeId, setAttributeId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  if (query.isPending) return <DataState loading />;
  if (query.isError)
    return <DataState error={query.error} retry={() => query.refetch()} />;
  const data = query.data;
  const type = data["product-types"]?.find(
    (row) => row.id === product.product_type,
  );
  const variants =
    data["product-variants"]?.filter(
      (row) => row.product === product.id && row.is_active !== false,
    ) ?? [];
  const attribute = data.attributes?.find(
    (row) => row.id === Number(attributeId),
  );
  const link = data["product-type-attributes"]?.find(
    (row) =>
      row.product_type === product.product_type &&
      row.attribute === Number(attributeId),
  );
  const target = variants.find((row) => row.id === Number(variantId));
  const resource = variantMode
    ? "variant-attribute-values"
    : "product-attribute-values";
  const existingValue = data[resource]?.find(
    (row) =>
      row.attribute === Number(attributeId) &&
      (variantMode ? row.variant === target?.id : row.product === product.id),
  );
  const scoped = {
    ...data,
    products: [product],
    attributes: attribute ? [attribute] : [],
    "product-types": type ? [type] : [],
    "product-variants": target ? [target] : [],
  };
  const blocked =
    product.is_active === false ||
    !type ||
    type.is_active === false ||
    (variantMode && !variants.length);
  const next = (selected: AdminRow) => {
    setAttributeId(String(selected.id));
    const binding = data["product-type-attributes"]?.find(
      (row) =>
        row.product_type === product.product_type &&
        row.attribute === selected.id,
    );
    setStage(
      binding && (!variantMode || binding.can_be_variant_option === true)
        ? "value"
        : "link",
    );
  };
  return (
    <section className="a-note" aria-label="Настройка атрибута и значения">
      <strong>Атрибут → привязка к типу → значение</strong>
      <p>
        Создайте определение или выберите существующее. Backend разрешает
        значение только после привязки к типу товара
        {variantMode ? " с включённой опцией варианта" : ""}.
      </p>
      {blocked && (
        <p role="status">
          Для добавления нужны активные товар и тип
          {variantMode ? ", а также активный вариант" : ""}. Сначала проверьте
          их настройки.
        </p>
      )}
      <div className="a-actions">
        <button
          className="s-button"
          disabled={blocked}
          onClick={() => {
            setAttributeId("");
            setVariantId(variants.length === 1 ? String(variants[0].id) : "");
            setStage("pick");
            setNotice("");
            setOpen(true);
          }}
        >
          Добавить атрибут и значение
        </button>
        <Link className="s-text-link" href="/admin/attributes">
          Все определения атрибутов
        </Link>
      </div>
      <p className="a-success" role="status">
        {notice}
      </p>
      <Drawer
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Атрибут и значение"
      >
        <p className="s-muted">
          Товар: {rowTitle(product)}. Тип: {type ? rowTitle(type) : "—"}.
        </p>
        <p role="status">
          {stage === "pick" || stage === "definition"
            ? "Шаг 1 из 3 · Определение"
            : stage === "link"
              ? "Шаг 2 из 3 · Привязка к типу"
              : "Шаг 3 из 3 · Значение"}
        </p>
        {stage === "pick" && (
          <div className="a-form">
            {variantMode && (
              <div className="a-field">
                <label htmlFor={`${inputId}-variant`}>
                  Вариант для значения
                </label>
                <select
                  id={`${inputId}-variant`}
                  value={variantId}
                  onChange={(event) => setVariantId(event.target.value)}
                >
                  <option value="">Выберите вариант…</option>
                  {variants.map((row) => (
                    <option key={row.id} value={row.id}>
                      {rowTitle(row)} · #{row.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="a-field">
              <label htmlFor={`${inputId}-attribute`}>
                Существующий атрибут
              </label>
              <select
                id={`${inputId}-attribute`}
                value={attributeId}
                onChange={(event) => setAttributeId(event.target.value)}
              >
                <option value="">Выберите атрибут…</option>
                {data.attributes?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {rowTitle(row)} · {String(row.data_type)}
                  </option>
                ))}
              </select>
            </div>
            {!data.attributes?.length && (
              <p>
                Определений пока нет. Создайте первое — затем укажите разрешения
                типа и значение.
              </p>
            )}
            <div className="a-actions">
              <button
                className="s-button"
                disabled={!attribute || (variantMode && !target)}
                onClick={() => {
                  if (attribute) next(attribute);
                }}
              >
                Продолжить с атрибутом
              </button>
              <button
                className="s-text-button"
                disabled={variantMode && !target}
                onClick={() => setStage("definition")}
              >
                Создать новый атрибут
              </button>
            </div>
          </div>
        )}
        {stage === "definition" && (
          <ResourceForm
            key="definition"
            resource="attributes"
            data={data}
            onBusyChange={setBusy}
            onSaved={(row) => {
              setAttributeId(String(row.id));
              setStage("link");
            }}
          />
        )}
        {stage === "link" && attribute && (
          <>
            <p className="a-note">
              Это общая схема типа «{type ? rowTitle(type) : "—"}», не только
              этого товара.{" "}
              {variantMode
                ? "Для значений варианта будет включена «Опция варианта»."
                : "Выберите, участвует ли атрибут в фильтрах и вариантах."}{" "}
              Определение уже существует; при ошибке привязки оно не удаляется.
            </p>
            <ResourceForm
              key={`link-${attribute.id}`}
              resource="product-type-attributes"
              row={
                link
                  ? {
                      ...link,
                      ...(variantMode ? { can_be_variant_option: true } : {}),
                    }
                  : undefined
              }
              initialValues={{
                id: 0,
                product_type: product.product_type,
                attribute: attribute.id,
                can_be_variant_option: variantMode,
              }}
              data={scoped}
              lockedFields={[
                "product_type",
                "attribute",
                ...(variantMode ? ["can_be_variant_option"] : []),
              ]}
              onBusyChange={setBusy}
              onSaved={() => setStage("value")}
            />
          </>
        )}
        {stage === "value" && attribute && (
          <>
            <p>
              {existingValue
                ? "Значение уже есть: оно будет обновлено, а не создано повторно."
                : "Привязка подтверждена. Теперь сохраните значение."}{" "}
              Поле зависит от типа атрибута; ноль и «Нет» — допустимые значения.
            </p>
            <ResourceForm
              key={`value-${attribute.id}-${target?.id ?? product.id}`}
              resource={resource}
              row={existingValue}
              initialValues={{
                id: 0,
                product: product.id,
                variant: target?.id,
                attribute: attribute.id,
              }}
              data={scoped}
              lockedFields={["product", "variant", "attribute"]}
              onBusyChange={setBusy}
              onSaved={() => {
                setOpen(false);
                setNotice(
                  existingValue
                    ? "Значение атрибута обновлено."
                    : "Атрибут привязан, значение сохранено.",
                );
              }}
            />
          </>
        )}
        {stage !== "pick" && (
          <button
            className="s-text-button"
            disabled={busy}
            onClick={() => setStage("pick")}
          >
            К выбору атрибута
          </button>
        )}
      </Drawer>
    </section>
  );
}
