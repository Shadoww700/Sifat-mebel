import { cache } from "react";
import { demoCatalog } from "./mock/catalog";
import { loadApiCatalog } from "./catalog-api";

import { catalogSource } from "./data-source";
export { catalogSource } from "./data-source";
// API failures never fall back to fixtures; demo must be explicitly selected.
export const getCatalog = cache(async () =>
  catalogSource === "api" ? loadApiCatalog() : demoCatalog,
);
