import { expect, test } from "@playwright/test";
import { demoCatalog, demoResponses } from "../src/lib/commerce/mock/catalog";
import { mapCatalog } from "../src/lib/commerce/catalog-mapper";
import {
  chooseOption,
  matchingVariants,
  selectionFor,
  variantAxes,
} from "../src/lib/commerce/variants";
import { productPrice } from "../src/lib/commerce/models";
import { attributeLabel } from "../src/lib/commerce/catalog-attributes";
import {
  attributeFacets,
  emptyFilters,
  filterProducts,
} from "../src/lib/commerce/browse";
import { contactSummary } from "../src/lib/commerce/contact";
import { loadApiCatalog } from "../src/lib/commerce/catalog-api";

test("demo fixtures and GET adapter produce identical catalog view models", async () => {
  const savedFetch = globalThis.fetch;
  const payloads: Record<string, unknown> = {
    "categories/": demoResponses.categories,
    "product-types/": demoResponses.types,
    "products/": demoResponses.products,
    "product-image": demoResponses.images,
    "attributes/": demoResponses.attributes!.definitions,
    "product-type-attributes/": demoResponses.attributes!.links,
    "product-attribute-values/": demoResponses.attributes!.values,
    "product-variants/": demoResponses.variants,
    "variant-attribute-values/": demoResponses.variantValues,
  };
  globalThis.fetch = async (input, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const path = new URL(String(input)).pathname.replace(
      "/api/v1/catalog/",
      "",
    );
    expect(payloads[path]).toBeDefined();
    return Response.json({ results: payloads[path], next: null });
  };
  try {
    const real = await loadApiCatalog();
    const expected = mapCatalog(
      demoResponses,
      "api",
      (path) =>
        new URL(path, process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000")
          .href,
    );
    expect(real).toEqual({ ...expected, issues: [] });
    expect(real.products[4].variants.map((v) => v.stock)).toEqual([4, 7, 0]);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("structured options resolve SKU, discount and unavailable combinations without name parsing", () => {
  const laptop = demoCatalog.products.find((p) => p.slug === "macbook-air-m4")!;
  const variants = laptop.variants.map((v) => ({
    ...v,
    name: "Not a parsable specification",
  }));
  expect(variantAxes(variants).map((a) => a.name)).toEqual(["RAM", "Storage"]);
  const selected = chooseOption(
    variants,
    selectionFor(variants[0]),
    "10",
    "number:512",
  );
  const variant = matchingVariants(variants, selected)[0];
  expect(variant.sku).toBe("MBA-M4-16-512");
  expect(productPrice(laptop, variant)).toBe(13400);
  expect(variant.price).toBe(13900);
  const large = chooseOption(
    variants,
    selectionFor(variants[0]),
    "9",
    "number:24",
  );
  expect(large).toEqual({ "9": "number:24", "10": "number:512" });
  expect(matchingVariants(variants, large)[0].stock).toBe(0);
  expect(
    matchingVariants(variants, { "9": "number:24", "10": "number:256" }),
  ).toEqual([]);
  expect(laptop.attributes.map(attributeLabel)).toEqual(["Midnight", "Нет"]);
  expect(contactSummary(laptop, variant)).toContain("Артикул: MBA-M4-16-512");
});

test("dynamic filters, price and availability must refer to the same variant", () => {
  const laptop = demoCatalog.products.find((p) => p.slug === "macbook-air-m4")!;
  const filters = {
    ...emptyFilters,
    type: "5",
    attributes: { "9": "number:24", "10": "number:256" },
  };
  expect(filterProducts([laptop], filters)).toHaveLength(0);
  filters.attributes["10"] = "number:512";
  expect(filterProducts([laptop], filters)).toHaveLength(1);
  expect(
    filterProducts([laptop], { ...filters, available: true }),
  ).toHaveLength(0);
  expect(filterProducts([laptop], { ...filters, max: "14000" })).toHaveLength(
    0,
  );
  expect(
    attributeFacets([laptop], emptyFilters)
      .find((f) => f.name === "RAM")
      ?.options.map((o) => o.label),
  ).toEqual(["16 GB", "24 GB"]);
});

test("inactive products and variants never enter catalog; unknown stock is not fabricated", () => {
  const input = structuredClone(demoResponses);
  input.products[0].is_active = false;
  input.variants[6].is_active = false;
  const mapped = mapCatalog(input, "demo", (path) => path);
  expect(mapped.products.some((p) => p.id === "1")).toBe(false);
  expect(
    mapped.products.find((p) => p.id === "5")?.variants.map((v) => v.sku),
  ).toEqual(["MBA-M4-16-512", "MBA-M4-24-512"]);
  const unknown = mapCatalog(
    { ...demoResponses, variants: [] },
    "demo",
    (path) => path,
  );
  expect(unknown.products[0].stock).toBeNull();
});
