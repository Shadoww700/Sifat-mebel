import { expect, test } from "@playwright/test";
import { demoCatalog, demoResponses } from "../src/lib/commerce/mock/catalog";
import { mapCatalog } from "../src/lib/commerce/catalog-mapper";
import {
  chooseOption,
  matchingVariants,
  selectionFor,
  variantAxes,
} from "../src/lib/commerce/variants";
import { productPrice, productStock } from "../src/lib/commerce/models";
import { attributeLabel } from "../src/lib/commerce/catalog-attributes";
import {
  attributeFacets,
  emptyFilters,
  filterProducts,
} from "../src/lib/commerce/browse";
import { contactSummary } from "../src/lib/commerce/contact";
import {
  loadApiCatalog,
  loadApiProduct,
} from "../src/lib/commerce/catalog-api";

test("paginated list uses the shared mapper without loading detail-only attributes and variants", async () => {
  const savedFetch = globalThis.fetch;
  const payloads: Record<string, unknown> = {
    "categories/": demoResponses.categories,
    "brands/": [],
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
    return Response.json(
      path === "products/"
        ? {
            count: demoResponses.products.length,
            results: payloads[path],
            next: null,
            previous: null,
          }
        : payloads[path],
    );
  };
  try {
    const real = await loadApiCatalog();
    const expected = mapCatalog(
      { ...demoResponses, attributes: null, variants: [], variantValues: [] },
      "api",
      (path) =>
        new URL(path, process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000")
          .href,
    );
    expect(real).toEqual({
      ...expected,
      issues: [],
      brands: [],
      pagination: {
        page: 1,
        pageSize: 20,
        count: demoResponses.products.length,
        pages: 1,
      },
    });
    expect(real.products[4].variants).toEqual([]);
    expect(real.products[4].stock).toBeNull();
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("one detail GET maps nested variants, dynamic attributes, false and zero without scanning any collection", async () => {
  const savedFetch = globalThis.fetch;
  const product = demoResponses.products.find((p) => p.id === 5)!;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({
      ...product,
      images: [
        {
          id: 900,
          product: product.id,
          image: "/media/audit-detail.jpg",
          alt_text: "Товар",
          is_primary: true,
          sort_order: 0,
        },
      ],
      attribute_values: [
        ...demoResponses.attributes!.values.filter(
          (v) => v.product === product.id,
        ),
        {
          id: 901,
          product: product.id,
          attribute: 902,
          attribute_info: {
            id: 902,
            name: "Числовой атрибут",
            slug: "numeric",
            data_type: "NUMBER",
            unit: "см",
          },
          value_text: null,
          value_number: "0.00",
          value_boolean: null,
        },
      ],
      variants: demoResponses.variants
        .filter((v) => v.product === product.id)
        .map((v) => ({
          ...v,
          attribute_values: demoResponses.variantValues.filter(
            (a) => a.variant === v.id,
          ),
        })),
    });
  };
  try {
    const result = await loadApiProduct("5");
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]).pathname).toBe("/api/v1/catalog/product/5/");
    expect(result?.variants.map((v) => v.stock)).toEqual([4, 7, 0]);
    expect(result?.attributes.some((a) => a.value === false)).toBe(true);
    expect(result?.attributes.find((a) => a.id === "902")).toMatchObject({
      value: 0,
      unit: "см",
    });
    expect(
      result?.variants.every((v) => v.attributes.every((a) => a.variantOption)),
    ).toBe(true);
    expect(result?.images.length).toBeGreaterThan(0);
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

test("OUT_OF_STOCK remains visible and overrides variant availability without altering physical variant quantities", () => {
  const data = structuredClone(demoResponses);
  data.products[0].status = "OUT_OF_STOCK";
  data.variants.find((v) => v.product === data.products[0].id)!.stock_quantity =
    8;
  for (const source of ["api", "demo"] as const) {
    const product = mapCatalog(data, source, (p) => p).products.find(
      (p) => p.id === String(data.products[0].id),
    )!;
    expect(product).toMatchObject({
      status: "OUT_OF_STOCK",
      available: false,
      stock: 0,
    });
    expect(product.variants[0].stock).toBe(8);
    expect(productStock(product, product.variants[0])).toBe(0);
    expect(filterProducts([product], emptyFilters)).toHaveLength(1);
    expect(
      filterProducts([product], { ...emptyFilters, available: true }),
    ).toEqual([]);
  }
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
