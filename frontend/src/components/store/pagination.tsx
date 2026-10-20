"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Only local URLs are generated; never navigate to a backend-supplied next URL. */
export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage?: (page: number) => void;
}) {
  const pathname = usePathname(),
    params = useSearchParams();
  if (pages <= 1) return null;
  function href(value: number) {
    const query = new URLSearchParams(params);
    if (value === 1) query.delete("page");
    else query.set("page", String(value));
    return `${pathname}${query.size ? `?${query}` : ""}`;
  }
  const link = (value: number, label: string) =>
    onPage ? (
      <button
        type="button"
        className="s-button s-button-outline"
        onClick={() => onPage(value)}
      >
        {label}
      </button>
    ) : (
      <Link
        className="s-button s-button-outline"
        href={href(value)}
        prefetch={false}
      >
        {label}
      </Link>
    );
  return (
    <nav className="s-pagination" aria-label="Страницы товаров">
      {page > 1 ? link(page - 1, "Назад") : <span />}
      <span role="status" aria-live="polite">
        Страница {page} из {pages}
      </span>
      {page < pages ? link(page + 1, "Далее") : <span />}
    </nav>
  );
}
