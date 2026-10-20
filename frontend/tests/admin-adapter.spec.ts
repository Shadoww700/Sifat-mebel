import { expect, test } from "@playwright/test";
import { apiAdminAdapter } from "../src/lib/admin/api";
import { initialDraft, payloadFor } from "../src/lib/admin/forms";
import { demoResponses } from "../src/lib/commerce/mock/catalog";

test("admin API adapter uses actual endpoints, multipart uploads and stock operation payload", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ id: 101 });
  };
  try {
    await apiAdminAdapter.save("products", { name: "Товар", brand: 3 }, 10);
    await apiAdminAdapter.save("product-images", {
      product: 10,
      image: new File(["test"], "test.webp", { type: "image/webp" }),
    });
    await apiAdminAdapter.remove("categories", 4);
    await apiAdminAdapter.adjust({
      variant_id: 51,
      operation: "OUT",
      quantity: 2,
      reason: "Проверка",
    });
    expect(calls.map((c) => [c.url, c.init?.method])).toEqual([
      ["/api/backend/v1/catalog/product/10", "PATCH"],
      ["/api/backend/v1/catalog/product-image", "POST"],
      ["/api/backend/v1/catalog/categories/4", "DELETE"],
      ["/api/backend/v1/catalog/stock/adjust", "POST"],
    ]);
    expect(calls[1].init?.body).toBeInstanceOf(FormData);
    expect(new Headers(calls[1].init?.headers).has("content-type")).toBe(false);
    expect(JSON.parse(String(calls[3].init?.body))).toEqual({
      variant_id: 51,
      operation: "OUT",
      quantity: 2,
      reason: "Проверка",
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("form payload preserves false/zero and nulls other typed columns; ignores read-only input", () => {
  const data = {
    products: demoResponses.products.map((p) => ({ ...p })),
    attributes: demoResponses.attributes!.definitions.map((a) => ({ ...a })),
    "product-type-attributes": demoResponses.attributes!.links.map((l) => ({
      ...l,
    })),
  };
  const result = payloadFor(
    "product-attribute-values",
    {
      ...initialDraft("product-attribute-values"),
      product: "5",
      attribute: "11",
      value_boolean: "false",
      value_text: "stale",
      value_number: "100",
      stock_quantity: "999",
    },
    data,
    false,
  );
  expect(result.errors).toEqual({});
  expect(result.values).toEqual({
    product: 5,
    attribute: 11,
    value_boolean: false,
    value_text: null,
    value_number: null,
  });
  const invalid = payloadFor(
    "product-attribute-values",
    { product: "1", attribute: "11", value_boolean: "false" },
    data,
    false,
  );
  expect(invalid.errors.attribute).toBeDefined();
  const numeric = payloadFor(
    "product-attribute-values",
    { product: "1", attribute: "3", value_number: "0" },
    data,
    false,
  );
  expect(numeric.errors).toEqual({});
  expect(numeric.values.value_number).toBe("0");
});
