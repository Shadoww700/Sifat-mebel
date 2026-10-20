"use client";
import { useFavoriteCollection } from "./favorites-provider";
import type { Product } from "./models";

// Source-prefixed keys prevent demo IDs from becoming unrelated real favorites.
export const favoriteKey = (product: Product) =>
  `${product.source}:${product.id}`;
export function useFavorites() {
  return useFavoriteCollection().keys;
}
