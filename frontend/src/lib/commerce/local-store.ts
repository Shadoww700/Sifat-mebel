"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { CartLine, Order } from "./models";
import { lineKey } from "./models";

const key = "sifat-commerce-demo-v1";
const item = z.object({
  key: z.string(),
  name: z.string(),
  variant: z.string(),
  image: z.string(),
  price: z.number().nonnegative(),
  quantity: z.number().int().min(1).max(20),
});
const address = z.object({
  recipient: z.string(),
  phone: z.string(),
  city: z.string(),
  street: z.string(),
  house: z.string(),
  apartment: z.string(),
});
const schema = z.object({
  favorites: z.array(z.string()).max(500),
  cart: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().nullable(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(200),
  orders: z
    .array(
      z.object({
        id: z.string(),
        createdAt: z.string(),
        status: z.enum(["created", "preparing", "delivered"]),
        items: z.array(item),
        delivery: z.enum(["delivery", "pickup"]),
        address,
        deliveryPrice: z.number().nonnegative(),
        source: z.literal("demo"),
      }),
    )
    .max(100),
});
type State = z.infer<typeof schema>;
const empty: State = { favorites: [], cart: [], orders: [] };
let snapshot = empty;
let lastRaw: string | null = null;
let memoryOnly = false;
const listeners = new Set<() => void>();
function read() {
  if (memoryOnly) return snapshot;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== lastRaw) {
      lastRaw = raw;
      snapshot = raw ? schema.parse(JSON.parse(raw)) : empty;
    }
  } catch {
    memoryOnly = true;
  }
  return snapshot;
}
function save(next: State) {
  snapshot = next;
  try {
    lastRaw = JSON.stringify(next);
    localStorage.setItem(key, lastRaw);
  } catch {
    memoryOnly = true;
  }
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const localCommerce = {
  add(line: CartLine, limit: number) {
    const state = read();
    const existing = state.cart.find((i) => lineKey(i) === lineKey(line));
    const quantity = Math.min(
      20,
      limit,
      (existing?.quantity ?? 0) + line.quantity,
    );
    if (quantity < 1) return;
    save({
      ...state,
      cart: existing
        ? state.cart.map((i) =>
            lineKey(i) === lineKey(line) ? { ...i, quantity } : i,
          )
        : [...state.cart, { ...line, quantity }],
    });
  },
  quantity(key: string, quantity: number) {
    const state = read();
    save({
      ...state,
      cart: state.cart.map((i) =>
        lineKey(i) === key
          ? { ...i, quantity: Math.min(20, Math.max(1, quantity)) }
          : i,
      ),
    });
  },
  remove(key: string) {
    const state = read();
    save({ ...state, cart: state.cart.filter((i) => lineKey(i) !== key) });
  },
  placeDemoOrder(order: Order) {
    const state = read();
    save({
      ...state,
      orders: [order, ...state.orders].slice(0, 100),
      cart: [],
    });
  },
};
export function useCommerce() {
  return useSyncExternalStore(subscribe, read, () => empty);
}
