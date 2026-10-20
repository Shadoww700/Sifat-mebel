import Link from "next/link";
import { getCatalog } from "@/lib/commerce/catalog";
import { ProductPhoto } from "@/components/store/product-image";
import {
  Breadcrumbs,
  EmptyState,
  SectionHeading,
} from "@/components/store/primitives";
import { Icon } from "@/components/store/icons";
export const metadata = { title: "Категории — Sifat Mebel" };
export default async function CategoriesPage() {
  const catalog = await getCatalog();
  return (
    <div className="s-container s-page">
      <Breadcrumbs items={[{ label: "Категории" }]} />
      <SectionHeading
        eyebrow="Категории и типы товаров"
        title="Место для вашего."
        text="Выберите категорию, затем — нужный тип товара."
      />
      {catalog.categories.length ? (
        <div className="s-category-grid">
          {catalog.categories.map((c, i) => (
            <article className="s-category" key={c.id}>
              <Link href={`/categories/${c.slug}`} className="s-category-image">
                <ProductPhoto
                  src={c.image}
                  alt={c.name}
                  sizes="(max-width: 767px) 100vw, 50vw"
                  priority={i === 0}
                />
                <span className="s-category-number">0{i + 1}</span>
              </Link>
              <div className="s-category-info">
                <h2>
                  <Link href={`/categories/${c.slug}`}>
                    {c.name}
                    <Icon name="arrow" />
                  </Link>
                </h2>
                <p>{c.description}</p>
                <div className="s-category-types">
                  {catalog.types
                    .filter((t) => t.categoryId === c.id)
                    .map((t) => (
                      <Link
                        key={t.id}
                        href={`/catalog?category=${c.id}&type=${t.id}`}
                      >
                        {t.name}
                      </Link>
                    ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Коллекция готовится"
          text="Новые пространства появятся здесь вместе с товарами."
        />
      )}
    </div>
  );
}
