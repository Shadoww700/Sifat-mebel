import type { Product, Variant } from "./models";
import { attributeLabel } from "./catalog-attributes";
import { resolvedAttributes } from "./variants";
import { money, productPrice } from "./models";

// Store contacts supplied by the owner; deployment overrides remain optional.
// Keep the local dialling number as supplied. Do not invent a country code.
const configuredPhone =
  process.env.NEXT_PUBLIC_STORE_PHONE?.trim() ?? "777-77-41-04";
export const storePhone = /^\+?\d{7,15}$/.test(
  configuredPhone.replace(/[ ()-]/g, ""),
)
  ? configuredPhone
  : "";
export const storePhoneHref = storePhone
  ? `tel:${storePhone.replace(/[^+\d]/g, "")}`
  : null;
const configuredMessage = process.env.NEXT_PUBLIC_STORE_MESSAGE_URL ?? "";
export const storeTelegramUrl = "https://t.me/sifat_mebel_sklad";
export const storeWhatsAppUrl = "https://wa.me/992777774104";
export const storeMessageUrl = /^https:\/\//.test(configuredMessage)
  ? configuredMessage
  : null;
export function contactSummary(product: Product, variant?: Variant) {
  return [
    product.name,
    variant?.name,
    `Артикул: ${variant?.sku ?? product.sku}`,
    ...resolvedAttributes(product, variant).map(
      (a) => `${a.name}: ${attributeLabel(a)}`,
    ),
    `Цена: ${money(productPrice(product, variant), product.currency)}`,
    product.source === "demo"
      ? "Демонстрационные данные — цену и наличие необходимо уточнить."
      : "Цену, наличие и доставку уточните у менеджера.",
  ]
    .filter(Boolean)
    .join("\n");
}
