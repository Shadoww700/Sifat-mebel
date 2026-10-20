import Image from "next/image";
import Link from "next/link";
import { getCatalog } from "@/lib/commerce/catalog";
import { ProductCard } from "@/components/store/product-card";
import {
  CollectionPreview,
  DemoNotice,
  EmptyState,
} from "@/components/store/primitives";
import { CatalogStatus } from "@/components/store/catalog-status";
import { Icon } from "@/components/store/icons";

export default async function HomePage() {
  const catalog = await getCatalog({ pageSize: 4, includeBrands: false });
  return (
    <>
      <section className="s-hero s-container">
        <div className="s-hero-copy">
          <span className="s-kicker">
            <span className="s-dot" />
            Sifat Mebel · Душанбе
          </span>
          <h1>
            Мебель для
            <br />
            <em>вашего дома.</em>
          </h1>
          <p>
            Выберите предмет, посмотрите размеры и варианты. Наличие и доставку
            уточним лично.
          </p>
          <Link className="s-button" href="/catalog">
            Открыть коллекцию
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="s-hero-visual">
          <Image
            src="/images/sifat-auth-interior.png"
            alt="Тёплый интерьер с креслом из ореха, светлым диваном и каменным столом"
            fill
            priority
            sizes="(max-width: 767px) 100vw, 62vw"
          />
        </div>
      </section>
      <nav
        className="s-home-shortcuts s-container"
        aria-label="Выбрать тип товара"
      >
        {catalog.types.map((type) => (
          <Link key={type.id} href={`/catalog?type=${type.id}`}>
            {type.name}
            <Icon name="arrow" />
          </Link>
        ))}
      </nav>
      <section className="s-container s-section">
        <div className="s-section-top">
          <div>
            <h2>Из коллекции</h2>
          </div>
          <Link className="s-text-link" href="/catalog">
            Вся коллекция
            <Icon name="arrow" />
          </Link>
        </div>
        <CatalogStatus issues={catalog.issues} />
        {catalog.products.length ? (
          <div className="s-product-grid">
            {catalog.products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <>
            <EmptyState
              title="Коллекция скоро появится"
              text="Новые предметы появятся здесь после публикации в магазине."
              href="/categories"
              action="Посмотреть пространства"
            />
            <CollectionPreview />
          </>
        )}
        {catalog.source === "demo" && <DemoNotice />}
      </section>
      <section className="s-home-help s-container" id="philosophy">
        <div>
          <h2>Нужна помощь с выбором?</h2>
          <p>
            Уточним размеры, наличие и варианты. Подскажем, какой предмет
            подойдёт вашему пространству.
          </p>
        </div>
        <Link className="s-text-link" href="/contact">
          Связаться с магазином
          <Icon name="arrow" />
        </Link>
      </section>
    </>
  );
}
