"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { sessionQueryOptions } from "@/lib/auth/session-query";
import { favoritesApi, type FavoriteDTO } from "./favorites-api";
import type { DataSource, Product } from "./models";

type Status = "loading" | "guest" | "error" | "demo" | "ready";
type Collection = {
  source: DataSource;
  status: Status;
  keys: string[];
  rows: FavoriteDTO[];
  pending: string[];
  error: string;
  refresh: () => void;
  toggle: (product: Product) => Promise<void>;
  remove: (favorite: FavoriteDTO) => Promise<void>;
};
const Context = createContext<Collection | null>(null);
export function useFavoriteCollection() {
  const value = useContext(Context);
  if (!value) throw new Error("Favorites require the storefront provider");
  return value;
}
export function FavoritesProvider({
  source,
  children,
  notify,
}: {
  source: DataSource;
  children: React.ReactNode;
  notify: (message: string) => void;
}) {
  const client = useQueryClient();
  const session = useQuery({
    ...sessionQueryOptions,
  });
  const userId = session.data?.id;
  const identity = useRef(userId);
  // Capture writes for their originating account, never publish into another.
  useEffect(() => {
    identity.current = userId;
    return () => {
      identity.current = undefined;
    };
  }, [userId]);
  const queryKey = ["commerce-favorites", userId] as const;
  const query = useQuery({
    queryKey,
    queryFn: favoritesApi.list,
    enabled:
      source === "api" &&
      Boolean(userId) &&
      !session.isError &&
      !session.isFetching,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const locks = useRef(new Set<string>());
  const [pending, setPending] = useState<string[]>([]);
  const guest =
    (session.error instanceof ApiError && session.error.status === 401) ||
    (query.error instanceof ApiError && query.error.status === 401);
  const status: Status =
    session.isPending || session.isFetching
      ? "loading"
      : guest
        ? "guest"
        : session.isError
          ? "error"
          : source === "demo"
            ? "demo"
            : query.isPending
              ? "loading"
              : query.isError
                ? "error"
                : "ready";
  const rows = source === "api" && status === "ready" ? (query.data ?? []) : [];
  const keys = rows.map((row) => `api:${row.product}`);
  async function write(productId: number, favorite?: FavoriteDTO) {
    if (source !== "api" || status !== "ready" || !userId) return;
    const lock = `${userId}:${productId}`;
    if (locks.current.has(lock)) return;
    locks.current.add(lock);
    setPending([...locks.current]);
    const owner = userId;
    try {
      if (favorite) {
        try {
          await favoritesApi.remove(favorite.id);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
        if (identity.current === owner)
          client.setQueryData<FavoriteDTO[]>(queryKey, (old = []) =>
            old.filter((row) => row.id !== favorite.id),
          );
      } else {
        const saved = await favoritesApi.add(productId);
        if (identity.current === owner)
          client.setQueryData<FavoriteDTO[]>(queryKey, (old = []) => [
            ...old.filter((row) => row.product !== productId),
            saved,
          ]);
      }
      if (identity.current === owner)
        notify(favorite ? "Удалено из избранного" : "Сохранено в избранном");
      await client.invalidateQueries({ queryKey });
    } catch (error) {
      if (identity.current === owner)
        notify(
          error instanceof Error
            ? error.message
            : "Не удалось изменить избранное",
        );
      if (error instanceof ApiError && error.status === 401) {
        client.removeQueries({ queryKey });
        await client.invalidateQueries({ queryKey: ["auth", "me"] });
      }
      // No automatic retry or local-success fallback on API failure.
    } finally {
      locks.current.delete(lock);
      setPending([...locks.current]);
    }
  }
  return (
    <Context.Provider
      value={{
        source,
        status,
        rows,
        keys,
        pending: pending
          .filter((key) => key.startsWith(`${userId}:`))
          .map((key) => `api:${key.split(":")[1]}`),
        error:
          (session.error ?? query.error)?.message ??
          "Не удалось загрузить избранное",
        refresh: () => {
          if (session.isError) void session.refetch();
          else void query.refetch();
        },
        toggle: async (product) => {
          if (
            source !== "api" ||
            product.source !== "api" ||
            status !== "ready"
          )
            return;
          await write(
            Number(product.id),
            rows.find((row) => row.product === Number(product.id)),
          );
        },
        remove: async (favorite) => {
          if (source === "api" && rows.some((row) => row.id === favorite.id))
            await write(favorite.product, favorite);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
