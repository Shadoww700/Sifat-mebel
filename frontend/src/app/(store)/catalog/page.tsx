import { CatalogBrowser } from "@/components/store/catalog-browser";
import { Breadcrumbs } from "@/components/store/primitives";
import { getCatalog } from "@/lib/commerce/catalog";
import { browseParams, pageNumber } from "@/lib/commerce/search-params";
export const metadata = { title: "Каталог — Sifat Mebel" };
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = browseParams(params);
  const catalog = await getCatalog({ page: pageNumber(params), filters });
  return (
    <div className="s-container s-page">
      <Breadcrumbs items={[{ label: "Каталог" }]} />
      <CatalogBrowser
        key={JSON.stringify(filters)}
        catalog={catalog}
        initial={filters}
      />
    </div>
  );
}
