import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/commerce/catalog";
import { Breadcrumbs } from "@/components/store/primitives";
import { ProductDetail } from "@/components/store/product-detail";
import { CatalogStatus } from "@/components/store/catalog-status";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, catalog] = await Promise.all([params, getCatalog()]);
  const product = catalog.products.find((p) => p.slug === slug);
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
  const [{ slug }, catalog] = await Promise.all([params, getCatalog()]);
  const product = catalog.products.find((p) => p.slug === slug);
  if (!product) notFound();
  return (
    <div className="s-container s-page s-detail-page">
      <Breadcrumbs
        items={[
          { label: "Коллекция", href: "/catalog" },
          {
            label: product.productType.name,
            href: `/catalog?type=${product.productType.id}`,
          },
          { label: product.name },
        ]}
      />
      <CatalogStatus issues={catalog.issues} />
      <ProductDetail
        key={product.id}
        product={product}
        related={catalog.products
          .filter(
            (p) =>
              p.id !== product.id &&
              p.productType.categoryId === product.productType.categoryId,
          )
          .slice(0, 4)}
      />
    </div>
  );
}
