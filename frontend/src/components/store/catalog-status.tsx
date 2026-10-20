"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Catalog } from "@/lib/commerce/models";
import { Icon } from "./icons";

export function CatalogStatus({ issues = [] }: { issues?: Catalog["issues"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!issues.length) return null;
  return (
    <aside
      className="s-catalog-status"
      aria-label="Состояние каталога"
      aria-busy={pending}
    >
      <Icon name="info" />
      <div role="status">
        {issues.map((issue) => (
          <p key={issue.scope}>{issue.message}</p>
        ))}
      </div>
      <button
        className="s-text-button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Обновляем…" : "Обновить"}
      </button>
    </aside>
  );
}
