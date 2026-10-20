import { CatalogBrowser } from "@/components/store/catalog-browser";
import { Breadcrumbs } from "@/components/store/primitives";
import { getCatalog } from "@/lib/commerce/catalog";
import { browseParams, pageNumber } from "@/lib/commerce/search-params";
export const metadata = { title: "Поиск — Sifat Mebel" };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = browseParams(params);
  const catalog = await getCatalog({ page: pageNumber(params), filters });
  return (
    <div className="s-container s-page">
      <Breadcrumbs items={[{ label: "Поиск" }]} />
      <CatalogBrowser
        key={JSON.stringify(filters)}
        catalog={catalog}
        initial={filters}
        title={
          filters.query ? `Поиск: «${filters.query}»` : "Что ищет ваш дом?"
        }
        search
      />
    </div>
  );
}
