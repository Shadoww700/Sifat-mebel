import type { DataSource } from "./models";

/** Ready backend APIs are the default. Fixtures require an explicit opt-in. */
export function resolveDataSources(config: {
  catalog?: string;
  admin?: string;
}) {
  const catalogSource: DataSource = config.catalog === "demo" ? "demo" : "api";
  const adminSource: DataSource =
    config.admin === "demo"
      ? "demo"
      : config.admin === "api"
        ? "api"
        : catalogSource;
  return { catalogSource, adminSource };
}
export const { catalogSource, adminSource } = resolveDataSources({
  catalog: process.env.SIFAT_CATALOG_SOURCE,
  admin: process.env.SIFAT_ADMIN_SOURCE,
});
