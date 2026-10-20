"use client";
import { EmptyState } from "@/components/store/primitives";
export default function StoreError({ reset }: { reset: () => void }) {
  return (
    <div className="s-container s-page">
      <EmptyState
        title="Небольшая пауза"
        text="Не удалось загрузить эту страницу. Попробуйте ещё раз через несколько секунд."
      >
        <button className="s-button" onClick={reset}>
          Загрузить снова
        </button>
      </EmptyState>
    </div>
  );
}
