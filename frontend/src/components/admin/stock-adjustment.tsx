"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/store/drawer";
import type { StockAdjustment } from "@/lib/admin/api";
import { rowTitle } from "@/lib/admin/resources";
import { useAdmin } from "./admin-shell";
import { AdminHeading, DataState, useAdminData } from "./data";

export function StockAdjustmentPage() {
  const query = useAdminData(["product-variants"]);
  const { adapter, run, source } = useAdmin();
  const [variant, setVariant] = useState("");
  const [operation, setOperation] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<StockAdjustment | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  if (query.isPending) return <DataState loading />;
  if (query.isError)
    return <DataState error={query.error} retry={() => query.refetch()} />;
  const variants = query.data["product-variants"] ?? [];
  const selected = variants.find((v) => v.id === Number(variant));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (
      !selected ||
      !Number.isSafeInteger(Number(quantity)) ||
      Number(quantity) < 1 ||
      reason.length > 255
    ) {
      setError(
        "Выберите вариант и положительное целое количество. Основание — до 255 символов.",
      );
      return;
    }
    if (
      operation === "OUT" &&
      Number(quantity) > Number(selected.stock_quantity)
    ) {
      setError(
        "Количество превышает загруженный остаток. Обновите данные или уменьшите количество.",
      );
      return;
    }
    setConfirm({
      variant_id: selected.id,
      operation,
      quantity: Number(quantity),
      reason: reason.trim(),
    });
  };
  const adjust = async () => {
    if (!confirm || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await run(() => adapter.adjust(confirm));
      setConfirm(null);
      setQuantity("");
      setReason("");
      setNotice("Корректировка проведена. Остаток и журнал обновлены.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось провести операцию",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <>
      <AdminHeading
        title="Корректировка остатков"
        text="Приход или списание конкретного SKU. Каждая операция создаёт запись в журнале."
      />
      <div className="a-stock-layout">
        <form className="a-form a-panel" onSubmit={submit}>
          <label htmlFor="stock-variant">Вариант *</label>
          <select
            id="stock-variant"
            value={variant}
            required
            onChange={(e) => setVariant(e.target.value)}
          >
            <option value="">Выберите вариант…</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {rowTitle(v)} · {String(v.sku)}
              </option>
            ))}
          </select>
          <label htmlFor="stock-operation">Операция *</label>
          <select
            id="stock-operation"
            value={operation}
            onChange={(e) => setOperation(e.target.value as "IN" | "OUT")}
          >
            <option value="IN">Приход</option>
            <option value="OUT">Списание</option>
          </select>
          <label htmlFor="stock-quantity">Количество *</label>
          <input
            id="stock-quantity"
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <label htmlFor="stock-reason">Основание</label>
          <textarea
            id="stock-reason"
            rows={3}
            maxLength={255}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: поступление от поставщика"
          />
          {error && !confirm && (
            <div role="alert" className="a-error">
              {error}
            </div>
          )}
          <p role="status" className="a-success">
            {notice}
          </p>
          <button className="s-button" disabled={!variants.length || pending}>
            Проверить корректировку
          </button>
        </form>
        <aside className="a-stock-summary">
          <span className="s-kicker">Выбранный SKU</span>
          <h2>{selected ? String(selected.sku) : "Выберите исполнение"}</h2>
          <p>Текущий остаток</p>
          <strong>
            {selected ? String(selected.stock_quantity) : "—"}
            <small> шт.</small>
          </strong>
          <p>
            Окончательную проверку остатка выполняет{" "}
            {source === "api" ? "backend" : "демоадаптер"} при сохранении.
          </p>
          <button
            className="s-text-button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            Обновить остаток
          </button>
          <Link className="s-text-link" href="/admin/stock-movements">
            История движений →
          </Link>
        </aside>
      </div>
      <Drawer
        open={Boolean(confirm)}
        onClose={() => {
          if (!pending) setConfirm(null);
        }}
        title="Подтвердить корректировку"
      >
        <p>
          <strong>{selected && String(selected.sku)}</strong>
        </p>
        <p>
          {confirm?.operation === "IN" ? "Приход" : "Списание"}:{" "}
          {confirm?.quantity} шт.
        </p>
        <p>{confirm?.reason || "Без основания"}</p>
        <p className="s-muted">
          {source === "api"
            ? "Будет изменён реальный остаток. Повторная отправка создаёт новую операцию."
            : "Изменится только учебный остаток в этой вкладке."}
        </p>
        {error && (
          <div role="alert" className="a-error">
            {error}
            <p>
              Если соединение прервалось, сначала проверьте журнал. Не
              отправляйте операцию повторно вслепую.
            </p>
            <Link href="/admin/stock-movements">Открыть историю движений</Link>
          </div>
        )}
        <div className="a-actions">
          <button className="s-button" disabled={pending} onClick={adjust}>
            {pending ? "Проводим…" : "Провести операцию"}
          </button>
          <button
            className="s-text-button"
            disabled={pending}
            onClick={() => setConfirm(null)}
          >
            Отмена
          </button>
        </div>
      </Drawer>
    </>
  );
}
