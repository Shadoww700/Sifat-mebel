import { EmptyState } from "@/components/store/primitives";
export default function StoreNotFound() {
  return (
    <div className="s-container s-page">
      <div className="s-error-code" aria-hidden="true">
        404
      </div>
      <EmptyState
        title="Этот предмет ещё не нашёлся"
        text="Возможно, адрес изменился. Продолжите знакомство с коллекцией."
      />
    </div>
  );
}
