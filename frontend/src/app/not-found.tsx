import { StoreShell } from "@/components/store/shell";
import { EmptyState } from "@/components/store/primitives";
export default function NotFound() {
  return (
    <StoreShell>
      <div className="s-container s-page">
        <div className="s-error-code" aria-hidden="true">
          404
        </div>
        <EmptyState
          title="Немного не по адресу"
          text="Такой страницы нет. Вернёмся туда, где начинается ваша история."
          href="/"
          action="На главную"
        />
      </div>
    </StoreShell>
  );
}
