import { Favorites } from "@/components/store/favorites";
import { Breadcrumbs } from "@/components/store/primitives";
export const metadata = { title: "Избранное — Sifat Mebel" };
export default async function FavoritesPage() {
  return (
    <div className="s-container s-page">
      <Breadcrumbs items={[{ label: "Избранное" }]} />
      <Favorites />
    </div>
  );
}
