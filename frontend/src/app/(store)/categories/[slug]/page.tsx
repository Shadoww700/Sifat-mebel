import { notFound } from "next/navigation";
import { CatalogBrowser } from "@/components/store/catalog-browser";
import { Breadcrumbs } from "@/components/store/primitives";
import { getCatalog, getNavigation } from "@/lib/commerce/catalog";
import { browseParams, pageNumber } from "@/lib/commerce/search-params";
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [navigation, { slug }, query] = await Promise.all([
    getNavigation(),
    params,
    searchParams,
  ]);
  const category = navigation.categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const filters = { ...browseParams(query), category: category.id };
  const catalog = await getCatalog({ page: pageNumber(query), filters });
  return (
    <div className="s-container s-page">
      <Breadcrumbs
        items={[
          { label: "Категории", href: "/categories" },
          { label: category.name },
        ]}
      />
      <CatalogBrowser
        key={JSON.stringify(filters)}
        catalog={catalog}
        initial={filters}
        title={category.name}
        lockedCategory
      />
    </div>
  );
}
