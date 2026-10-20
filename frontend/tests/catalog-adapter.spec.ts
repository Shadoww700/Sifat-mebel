import { expect, test } from "@playwright/test";
import { loadApiCatalog } from "../src/lib/commerce/catalog-api";
import { filterProducts, emptyFilters } from "../src/lib/commerce/browse";
import { resolveCart } from "../src/lib/commerce/cart";
import { demoCatalog } from "../src/lib/commerce/mock/catalog";
import {
  productAttributes,
  type AttributeData,
  attributeLabel,
  attributeToken,
} from "../src/lib/commerce/catalog-attributes";
import { attributeFacets } from "../src/lib/commerce/browse";
import { browseParams } from "../src/lib/commerce/search-params";

// Test-only responses for the existing read endpoints. No server or backend writes.
test("catalog adapter joins new attribute endpoints with existing products without inventing stock", async () => {
  const savedFetch = globalThis.fetch;
  const requests: string[] = [];
  const category = {
    id: 1,
    name: "Гостиная",
    slug: "living",
    description: "",
    image: null,
  };
  const type = {
    id: 2,
    name: "Кресла",
    slug: "chairs",
    category: 1,
    category_info: category,
  };
  globalThis.fetch = async (input, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const url = new URL(String(input));
    requests.push(url.pathname + url.search);
    const payloads: Record<string, unknown> = {
      "/api/v1/catalog/attributes/": attributes.definitions,
      "/api/v1/catalog/product-type-attributes/": attributes.links.map(
        (link) => ({ ...link, product_type: 2 }),
      ),
      "/api/v1/catalog/product-attribute-values/": attributes.values,
      "/api/v1/catalog/product-variants/": [],
      "/api/v1/catalog/variant-attribute-values/": [],
      "/api/v1/catalog/categories/": [category],
      "/api/v1/catalog/product-types/": [type],
      "/api/v1/catalog/products/": {
        next: new URL("/api/v1/catalog/products/?page=2", url.origin).href,
        results: [
          {
            id: 10,
            slug: "real-chair",
            name: "Кресло",
            description: "",
            short_description: "Описание",
            product_type_info: type,
            brand_info: null,
            sku: "A1",
            base_price: "4500.50",
            discount_price: "4000.25",
            currency: "TJS",
            status: "ACTIVE",
            warranty: "12 месяцев",
            country_of_origin: "Таджикистан",
            is_featured: false,
          },
        ],
      },
      "/api/v1/catalog/products/?page=2": { next: null, results: [] },
      "/api/v1/catalog/product-image": [
        {
          id: 1,
          product: 10,
          image: "/media/second.webp",
          alt_text: "Ракурс",
          is_primary: false,
          sort_order: 0,
        },
        {
          id: 2,
          product: 10,
          image: "/media/primary.webp",
          alt_text: "",
          is_primary: true,
          sort_order: 2,
        },
      ],
    };
    expect(payloads[url.pathname + url.search]).toBeDefined();
    return Response.json(payloads[url.pathname + url.search]);
  };
  try {
    const catalog = await loadApiCatalog();
    expect(catalog.source).toBe("api");
    expect(catalog.products).toHaveLength(1);
    const product = catalog.products[0];
    expect(product).toMatchObject({
      id: "10",
      source: "api",
      basePrice: 4500.5,
      discountPrice: 4000.25,
      stock: null,
      attributes: [
        {
          id: "3",
          name: "Механизм раскладывания",
          value: false,
          filterable: true,
        },
        {
          id: "2",
          name: "Допустимая нагрузка",
          value: 0,
          unit: "кг",
          filterable: true,
        },
        {
          id: "1",
          name: "Материал основания",
          value: "Массив ореха",
          filterable: false,
        },
      ],
      variants: [],
      description: "Описание",
      brand: "",
    });
    expect(product.images[0].src).toContain("/media/primary.webp");
    expect(product.images[0].alt).toBe("Кресло");
    expect(
      filterProducts(catalog.products, { ...emptyFilters, available: true }),
    ).toEqual([]);
    expect(requests).toHaveLength(10);
    expect(catalog.issues).toEqual([]);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

const attributes: AttributeData = {
  definitions: [
    {
      id: 1,
      name: "Материал основания",
      slug: "base-material",
      data_type: "TEXT",
      unit: "",
    },
    {
      id: 2,
      name: "Допустимая нагрузка",
      slug: "load",
      data_type: "NUMBER",
      unit: "кг",
    },
    {
      id: 3,
      name: "Механизм раскладывания",
      slug: "folding",
      data_type: "BOOLEAN",
      unit: "",
    },
    {
      id: 4,
      name: "Незаполненная характеристика",
      slug: "missing",
      data_type: "TEXT",
      unit: "",
    },
  ],
  links: [],
  values: [],
};
attributes.links = attributes.definitions.map((definition, index) => ({
  id: index + 1,
  product_type: 5,
  attribute: definition.id,
  attribute_info: definition,
  sort_order: 4 - index,
  is_required: false,
  is_filterable: definition.id !== 1,
}));
attributes.values = attributes.definitions.map((definition, index) => ({
  id: index + 1,
  product: 10,
  attribute: definition.id,
  attribute_info: definition,
  value_text: index === 0 ? "Массив ореха" : null,
  value_number: index === 1 ? "0.00" : null,
  value_boolean: index === 2 ? false : null,
}));

test("dynamic API attributes respect ProductType order, data types, zero and false", () => {
  const result = productAttributes(10, 5, attributes);
  expect(result.map((a) => a.id)).toEqual(["3", "2", "1"]);
  expect(result.map((a) => a.value)).toEqual([false, 0, "Массив ореха"]);
  expect(result.map(attributeLabel)).toEqual(["Нет", "0 кг", "Массив ореха"]);
  expect(result.map((a) => a.filterable)).toEqual([true, true, false]);
  expect(productAttributes(10, 999, attributes)).toEqual([]);
  expect(productAttributes(999, 5, attributes)).toEqual([]);
});

test("attribute filters are data-driven, URL-safe and exclude non-filterable fields", () => {
  const product = {
    ...demoCatalog.products[0],
    attributes: productAttributes(10, 5, attributes),
  };
  const params = browseParams({ "attr.3": "boolean:false" });
  expect(filterProducts([product], params)).toHaveLength(1);
  expect(
    filterProducts([product], {
      ...params,
      attributes: { "3": "boolean:true" },
    }),
  ).toHaveLength(0);
  expect(
    filterProducts([product], {
      ...params,
      attributes: { "1": "string:Массив ореха" },
    }),
  ).toHaveLength(0);
  expect(attributeToken("false")).not.toBe(attributeToken(false));
  const facets = attributeFacets([product], emptyFilters);
  expect(facets.map((f) => f.name)).toEqual([
    "Механизм раскладывания",
    "Допустимая нагрузка",
  ]);
  expect(facets[0].options[0]).toMatchObject({
    value: "boolean:false",
    label: "Нет",
  });
});

test("optional image and attribute API failures are explicit without replacing real products", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (
      [
        "/api/v1/catalog/categories/",
        "/api/v1/catalog/product-types/",
        "/api/v1/catalog/products/",
      ].includes(path)
    )
      return Response.json([]);
    return Response.json({ detail: "Unavailable" }, { status: 500 });
  };
  try {
    const catalog = await loadApiCatalog();
    expect(catalog.source).toBe("api");
    expect(catalog.products).toEqual([]);
    expect(catalog.issues?.map((issue) => issue.scope)).toEqual([
      "attributes",
      "images",
      "variants",
    ]);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("catalog API failures are not silently replaced with demo products", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ detail: "Unavailable" }, { status: 503 });
  try {
    await expect(loadApiCatalog()).rejects.toThrow("Catalog API returned 503");
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("catalog pagination cannot redirect reads to another origin", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ results: [], next: "https://untrusted.example/data" });
  try {
    await expect(loadApiCatalog()).rejects.toThrow(
      "Invalid catalog pagination",
    );
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("cart rejects missing products, missing variants and insufficient stock", () => {
  const sofa = demoCatalog.products.find((p) => p.slug === "sokin-sofa")!;
  const variant = sofa.variants.find((v) => v.stock === 2)!;
  const lines = resolveCart(
    [
      { productId: "missing", variantId: null, quantity: 1 },
      { productId: sofa.id, variantId: null, quantity: 1 },
      { productId: sofa.id, variantId: "missing", quantity: 1 },
      { productId: sofa.id, variantId: variant.id, quantity: 3 },
      { productId: sofa.id, variantId: variant.id, quantity: 2 },
    ],
    demoCatalog.products,
  );
  expect(lines.map((line) => line.valid)).toEqual([
    false,
    false,
    false,
    false,
    true,
  ]);
  expect(lines.at(-1)?.price).toBe(variant.price);
});
