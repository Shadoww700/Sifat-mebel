"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "./admin-shell";
import type { AdminRow } from "@/lib/admin/resources";
import { Pagination } from "@/components/store/pagination";

/** Paginated FK lookup, not a request to load every product into a select. */
export function ProductLookup({ onPick }: { onPick: (row: AdminRow) => void }) {
  const { adapter, source, user } = useAdmin();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["admin-data", source, user.id, "product-lookup", search, page],
    enabled: open,
    retry: false,
    queryFn: () => adapter.productPage!(page, search),
  });
  const submit = () => {
    setSearch(input);
    setPage(1);
    setOpen(true);
  };
  return (
    <div className="a-note">
      <p>
        Не нашли товар в списке? Поиск по названию, бренду или типу загружает
        одну страницу API.
      </p>
      <div className="a-actions">
        <input
          aria-label="Найти товар для связи"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="s-text-button" onClick={submit}>
          Найти товар
        </button>
      </div>
      {open &&
        (query.isPending ? (
          <p role="status">Поиск товаров…</p>
        ) : query.isError ? (
          <p role="alert">{query.error.message}</p>
        ) : (
          <>
            <p role="status">Найдено: {query.data.count}</p>
            <div className="a-form">
              {query.data.rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="s-text-button"
                  onClick={() => {
                    onPick(row);
                    setOpen(false);
                  }}
                >
                  Выбрать: {String(row.name)} · #{row.id}
                </button>
              ))}
            </div>
            <Pagination page={page} pages={query.data.pages} onPage={setPage} />
          </>
        ))}
    </div>
  );
}
