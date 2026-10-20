"use client";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  resources,
  rowTitle,
  type AdminRow,
  type ResourceKey,
} from "@/lib/admin/resources";
import {
  initialDraft,
  payloadFor,
  referenceOptions,
  valueField,
  type ReferenceData,
} from "@/lib/admin/forms";
import { useAdmin } from "./admin-shell";

export function ResourceForm({
  resource,
  row,
  data,
  onSaved,
  onBusyChange,
  initialValues,
  lockedFields = [],
}: {
  resource: ResourceKey;
  row?: AdminRow;
  data: ReferenceData;
  onSaved: (row: AdminRow) => void;
  onBusyChange: (busy: boolean) => void;
  initialValues?: AdminRow;
  lockedFields?: string[];
}) {
  const { adapter, run } = useAdmin();
  const [draft, setDraft] = useState(() =>
    initialDraft(resource, row ?? initialValues),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const valueKey = valueField(draft, data);
  const fields = resources[resource].fields.filter(
    (f) => !f.key.startsWith("value_") || f.key === valueKey,
  );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    const result = payloadFor(resource, draft, data, Boolean(row));
    setErrors(result.errors);
    if (Object.keys(result.errors).length) {
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    locked.current = true;
    setPending(true);
    onBusyChange(true);
    try {
      const saved = await run(() =>
        adapter.save(resource, result.values, row?.id),
      );
      onSaved(saved);
    } catch (error) {
      const errors: Record<string, string> = {
        _form:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить запись",
      };
      if (error instanceof ApiError)
        for (const [key, value] of Object.entries(error.fields))
          errors[key] = Array.isArray(value) ? value.join(" ") : String(value);
      setErrors(errors);
    } finally {
      locked.current = false;
      setPending(false);
      onBusyChange(false);
    }
  }
  return (
    <form ref={formRef} className="a-form" onSubmit={save} noValidate>
      <p className="s-muted">
        {row ? `Запись #${row.id}.` : "Новая запись."} Поля со звёздочкой
        обязательны.
      </p>
      <fieldset disabled={pending} className="a-form-fields">
        {fields.map((field) => {
          const id = `admin-${resource}-${field.key}`;
          const required =
            (field.required && !(field.type === "file" && row)) ||
            field.key === valueKey;
          const common = {
            id,
            name: field.key,
            "aria-invalid": Boolean(errors[field.key]),
            "aria-describedby": errors[field.key] ? `${id}-error` : undefined,
            required: Boolean(required),
            disabled: lockedFields.includes(field.key),
          };
          const value = draft[field.key];
          const set = (value: string | boolean | File) =>
            setDraft((old) => {
              const next = { ...old, [field.key]: value };
              if (
                ["product", "variant"].includes(field.key) &&
                resource.endsWith("attribute-values")
              )
                next.attribute = "";
              if (["attribute", "product", "variant"].includes(field.key)) {
                next.value_text = "";
                next.value_number = "";
                next.value_boolean = "";
              }
              return next;
            });
          const options = referenceOptions(field, draft, data, resource);
          return (
            <div
              className={`a-field${field.type === "boolean" ? " a-check" : ""}`}
              key={field.key}
            >
              <label htmlFor={id}>
                {field.label}
                {required ? " *" : ""}
              </label>
              {field.type === "boolean" ? (
                <input
                  {...common}
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => set(e.target.checked)}
                />
              ) : field.type === "file" ? (
                <>
                  <input
                    {...common}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => set(e.target.files?.[0] ?? "")}
                  />
                  <small>
                    JPG, PNG, WebP · до 3 МБ.{" "}
                    {row?.[field.key]
                      ? "Без нового файла текущее изображение сохранится."
                      : ""}
                  </small>
                </>
              ) : field.type === "select" || field.type === "ref" ? (
                <select
                  {...common}
                  value={String(value ?? "")}
                  onChange={(e) => set(e.target.value)}
                >
                  <option value="">Выберите…</option>
                  {field.type === "ref"
                    ? options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {rowTitle(option)} · #{option.id}
                        </option>
                      ))
                    : field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option === "true"
                            ? "Да"
                            : option === "false"
                              ? "Нет"
                              : (field.optionLabels?.[option] ?? option)}
                        </option>
                      ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  {...common}
                  value={String(value ?? "")}
                  rows={4}
                  maxLength={field.max}
                  onChange={(e) => set(e.target.value)}
                />
              ) : (
                <input
                  {...common}
                  type={
                    field.type === "number" || field.type === "decimal"
                      ? "number"
                      : "text"
                  }
                  step={
                    field.type === "decimal"
                      ? "0.01"
                      : field.type === "number"
                        ? "1"
                        : undefined
                  }
                  min={field.min}
                  maxLength={field.max}
                  value={String(value ?? "")}
                  onChange={(e) => set(e.target.value)}
                />
              )}
              {field.type === "ref" && !options.length && (
                <small>
                  Нет доступных записей. Сначала заполните связанный раздел
                  {field.key === "attribute" ? " и схему типа" : ""}.
                </small>
              )}
              {field.key === "slug" && (
                <small>
                  Латиница, цифры, дефис или подчёркивание. Например:
                  seat-height.
                </small>
              )}
              {errors[field.key] && (
                <p className="a-field-error" id={`${id}-error`}>
                  {errors[field.key]}
                </p>
              )}
            </div>
          );
        })}
      </fieldset>
      {errors._form && (
        <div className="a-error" role="alert">
          {errors._form}
        </div>
      )}
      <div className="a-form-footer">
        <button type="submit" className="s-button" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
        <span role="status">
          {pending ? "Не закрывайте окно до завершения запроса." : ""}
        </span>
      </div>
    </form>
  );
}
