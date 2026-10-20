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
import "@/styles/home-intro.css";
import "@/styles/home-sections.css";
import {
  storePhone,
  storePhoneHref,
  storeWhatsAppUrl,
} from "@/lib/commerce/contact";

export default async function HomePage() {
  const catalog = await getCatalog({ pageSize: 4, includeBrands: false });
  return (
    <>
      <section
        className="s-home-intro s-container"
        aria-labelledby="home-intro-title"
      >
        <div className="s-home-intro-copy">
          <span className="s-kicker">
            <span className="s-dot" />
            Sifat Mebel · Душанбе
          </span>
          <h1 id="home-intro-title">
            <span>Мебель для</span> <em>вашего дома.</em>
          </h1>
          <p>
            Выберите мебель, которая подходит вашему дому. Размеры, наличие и
            доставку обсудим лично.
          </p>
          <div className="s-home-intro-actions">
            <Link className="s-button" href="/catalog">
              Смотреть каталог
              <Icon name="arrow" />
            </Link>
            <Link className="s-home-intro-contact" href="/contact">
              Помочь с выбором
            </Link>
          </div>
          <div className="s-home-intro-note">
            <span aria-hidden="true" />
            Ваш дом начинается с деталей.
          </div>
        </div>
        <figure className="s-home-intro-art">
          <div className="s-home-intro-photo">
            <Image
              src="/images/sifat-auth-interior.png"
              alt="Тёплый интерьер с креслом из ореха, светлым диваном и каменным столом"
              fill
              priority
              sizes="(max-width: 767px) 92vw, (max-width: 1826px) 52vw, 900px"
            />
          </div>
          <figcaption>
            <span>Тёплые фактуры. Спокойные формы.</span>
            <span>Sifat Mebel</span>
          </figcaption>
        </figure>
      </section>
      <div className="s-home-body">
        {catalog.categories.length > 0 && (
          <section
            className="s-home-categories s-container"
            aria-labelledby="home-categories-title"
          >
            <div className="s-home-section-heading">
              <div>
                <span className="s-kicker">С чего начнём?</span>
                <h2 id="home-categories-title">Разделы каталога</h2>
              </div>
              <Link className="s-text-link" href="/categories">
                Все категории
                <Icon name="arrow" />
              </Link>
            </div>
            <nav
              className="s-home-category-links"
              aria-label="Категории товаров"
            >
              {catalog.categories.slice(0, 6).map((category, index) => (
                <Link
                  key={category.id}
                  href={`/categories/${encodeURIComponent(category.slug)}`}
                  prefetch={false}
                >
                  <span className="s-home-category-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{category.name}</span>
                  <Icon name="arrow" />
                </Link>
              ))}
            </nav>
          </section>
        )}
        <section
          className="s-container s-home-collection"
          aria-labelledby="home-collection-title"
        >
          <div className="s-home-section-heading">
            <div>
              <span className="s-kicker">Рассмотрите поближе</span>
              <h2 id="home-collection-title">Из коллекции</h2>
              <p>Формы, фактуры и детали для вашего пространства.</p>
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
        <section
          className="s-container s-home-support-wrap"
          id="philosophy"
          aria-labelledby="home-support-title"
        >
          <div className="s-home-support">
            <div className="s-home-support-copy">
              <span className="s-kicker">Давайте обсудим</span>
              <h2 id="home-support-title">
                Нужна помощь
                <br />с выбором?
              </h2>
              <p>
                Уточним размеры, наличие и варианты. Подскажем, какой предмет
                подойдёт вашему пространству.
              </p>
              <dl className="s-home-support-details">
                <div>
                  <dt>Размеры и варианты</dt>
                  <dd>Разберём детали выбранного товара.</dd>
                </div>
                <div>
                  <dt>Наличие и доставка</dt>
                  <dd>Уточним наличие, сроки и условия.</dd>
                </div>
              </dl>
            </div>
            <div className="s-home-support-contact">
              <span className="s-kicker">Напрямую с магазином</span>
              {storePhoneHref && (
                <a className="s-home-support-phone" href={storePhoneHref}>
                  {storePhone}
                </a>
              )}
              <p>
                Можно позвонить или отправить ссылку на понравившийся товар.
              </p>
              <a
                className="s-button"
                href={storeWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Написать в WhatsApp
                <Icon name="arrow" />
              </a>
              <Link className="s-text-link" href="/contact">
                Все способы связи
                <Icon name="arrow" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
