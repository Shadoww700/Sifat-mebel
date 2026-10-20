import { cache } from "react";
import { notFound } from "next/navigation";
import { demoCatalog } from "./mock/catalog";
import {
  CatalogApiError,
  loadApiCatalog,
  loadApiNavigation,
  loadApiProduct,
  type CatalogRequest,
} from "./catalog-api";

import { catalogSource } from "./data-source";
export { catalogSource } from "./data-source";
// API failures never fall back to fixtures; demo must be explicitly selected.
export const getCatalog = cache(async (options: CatalogRequest = {}) => {
  if (catalogSource !== "api") return demoCatalog;
  try {
    return await loadApiCatalog(options);
  } catch (error) {
    if (error instanceof CatalogApiError && error.status === 404) notFound();
    throw error;
  }
});
export const getNavigation = cache(async () =>
  catalogSource === "api" ? loadApiNavigation() : demoCatalog,
);
export const getProduct = cache(async (id: string) =>
  catalogSource === "api"
    ? loadApiProduct(id)
    : (demoCatalog.products.find((p) => p.slug === id || p.id === id) ?? null),
);
