"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/lib/auth/session-query";
import { apiRequest } from "@/lib/api/client";
import { Icon } from "@/components/store/icons";

/** The storefront imports only this verified link, never the management shell. */
export function useVerifiedAdmin() {
  const session = useQuery(sessionQueryOptions);
  const eligible =
    session.data?.role === "ADMIN" && !session.isError && !session.isFetching;
  const access = useQuery({
    queryKey: ["admin-entry-permission", session.data?.id],
    enabled: eligible,
    queryFn: async () => {
      await apiRequest("/catalog/stock/movements", {
        method: "OPTIONS",
        cache: "no-store",
      });
      return true;
    },
    retry: false,
    staleTime: 0,
  });
  return (
    eligible && Boolean(access.data) && !access.isError && !access.isFetching
  );
}
export function AdminEntry({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const verified = useVerifiedAdmin();
  if (!verified) return null;
  return (
    <Link
      className={compact ? "s-icon-button s-admin-shortcut" : "s-text-link"}
      href="/admin"
      onClick={onNavigate}
      title={compact ? "Управление магазином" : undefined}
      aria-label={compact ? "Открыть панель администратора" : undefined}
    >
      {!compact && "Управление магазином"}
      <Icon name={compact ? "box" : "arrow"} />
    </Link>
  );
}
