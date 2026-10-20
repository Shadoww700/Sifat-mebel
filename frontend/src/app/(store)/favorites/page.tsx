import { getCatalog } from "@/lib/commerce/catalog";
import { Favorites } from "@/components/store/favorites";
import { Breadcrumbs } from "@/components/store/primitives";
export const metadata = { title: "Избранное — Sifat Mebel" };
export default async function FavoritesPage() {
  const catalog = await getCatalog();
  return (
    <div className="s-container s-page">
      <Breadcrumbs items={[{ label: "Избранное" }]} />
      <Favorites products={catalog.products} />
    </div>
  );
}
