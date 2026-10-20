import { notFound } from "next/navigation";
import { getProduct, catalogSource } from "@/lib/commerce/catalog";
import { Breadcrumbs, EmptyState } from "@/components/store/primitives";
import { ProductDetail } from "@/components/store/product-detail";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  return {
    title: `${product?.name ?? "Предмет не найден"} — Sifat Mebel`,
    description: product?.description,
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Django detail is keyed by ID, not slug. Old slug-only API bookmarks must not
  // trigger a catalog-wide scan; offer an explicit route back to the catalog.
  if (catalogSource === "api" && !/^[1-9]\d*$/.test(slug))
    return (
      <div className="s-container s-page">
        <EmptyState
          title="Обновлённая ссылка на товар"
          text="Откройте товар в каталоге — новые ссылки используют его постоянный ID."
          href="/catalog"
          action="Открыть каталог"
        />
      </div>
    );
  const product = await getProduct(slug);
  if (!product) notFound();
  return (
    <div className="s-container s-page s-detail-page">
      <Breadcrumbs
        items={[
          { label: "Коллекция", href: "/catalog" },
          {
            label: product.productType.name,
            ...(product.source === "demo"
              ? { href: `/catalog?type=${product.productType.id}` }
              : {}),
          },
          { label: product.name },
        ]}
      />
      <ProductDetail key={product.id} product={product} related={[]} />
    </div>
  );
}
