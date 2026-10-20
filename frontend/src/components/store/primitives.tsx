import Link from "next/link";
import { Icon, type IconName } from "./icons";
import { ProductPhoto } from "./product-image";
import { collectionPreview } from "@/lib/commerce/preview";

export function SectionHeading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="s-heading">
      {eyebrow && <span className="s-kicker">{eyebrow}</span>}
      <div className="s-heading-row">
        <div>
          <h1>{title}</h1>
          {text && <p>{text}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="s-breadcrumbs" aria-label="Хлебные крошки">
      <Link href="/">Главная</Link>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          <span aria-hidden="true">/</span>
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
export function EmptyState({
  icon = "box",
  title,
  text,
  href = "/catalog",
  action = "Открыть коллекцию",
  children,
}: {
  icon?: IconName;
  title: string;
  text: string;
  href?: string;
  action?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="s-empty">
      <span className="s-empty-icon">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children ?? (
        <Link className="s-button" href={href}>
          {action}
          <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}
export function DemoNotice({ checkout = false }: { checkout?: boolean }) {
  return (
    <p className="s-demo-note">
      <span className="s-dot" />
      {checkout
        ? "Демонстрационный заказ. Сохраняется только в этом браузере. Оплата и отправка не выполняются."
        : "Демонстрационная коллекция. Товары, цены и характеристики приведены для знакомства с магазином."}
    </p>
  );
}
export function ProductSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div
      className="s-product-grid"
      role="status"
      aria-label="Загружаем коллекцию"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="s-skeleton-card">
          <div className="s-skeleton s-skeleton-image" />
          <div className="s-skeleton s-skeleton-line" />
          <div className="s-skeleton s-skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function CollectionPreview() {
  return (
    <section
      className="s-collection-preview"
      aria-labelledby="collection-preview-title"
    >
      <div className="s-collection-preview-heading">
        <span className="s-kicker">Визуальная концепция</span>
        <h2 id="collection-preview-title">
          Четыре настроения будущей коллекции.
        </h2>
        <p>
          Это демонстрационные изображения, а не опубликованные товары из API.
          Реальные названия, цены и характеристики появятся после наполнения
          каталога.
        </p>
      </div>
      <div className="s-collection-preview-grid">
        {collectionPreview.map((item) => (
          <figure key={item.src}>
            <div>
              <ProductPhoto
                src={item.src}
                alt={item.alt}
                sizes="(max-width: 599px) 50vw, 25vw"
                contain
              />
            </div>
            <figcaption>{item.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
