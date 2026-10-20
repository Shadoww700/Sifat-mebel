"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/lib/auth/session-query";
import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/auth/types";
import { EmptyState } from "./primitives";
import { Icon, type IconName } from "./icons";

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links: { href: string; label: string; icon: IconName }[] = [
    { href: "/account", label: "Мой профиль", icon: "user" },
    { href: "/addresses", label: "Мои адреса", icon: "location" },
    { href: "/contact", label: "Связаться с магазином", icon: "phone" },
    { href: "/favorites", label: "Избранное", icon: "heart" },
  ];
  return (
    <div className="s-account-layout">
      <nav className="s-account-nav" aria-label="Личный кабинет">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname.startsWith(link.href) ? "page" : undefined}
          >
            <Icon name={link.icon} />
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="s-account-content">{children}</div>
    </div>
  );
}

export function SessionGate({
  children,
}: {
  children: (user: User) => React.ReactNode;
}) {
  const session = useQuery({
    ...sessionQueryOptions,
    staleTime: 0,
  });
  if (session.isPending || session.isFetching)
    return (
      <div role="status" aria-label="Проверяем сессию">
        <div className="s-skeleton s-skeleton-line" />
        <div className="s-skeleton s-skeleton-profile" />
      </div>
    );
  if (session.error instanceof ApiError && session.error.status === 401)
    return (
      <EmptyState
        icon="user"
        title="Ваше личное пространство"
        text="Войдите в аккаунт, чтобы управлять профилем и адресами доставки."
        href="/auth/login"
        action="Войти в аккаунт"
      />
    );
  if (session.isError)
    return (
      <EmptyState
        title="Не удалось загрузить профиль"
        text="Сервис временно недоступен. Попробуйте подключиться ещё раз."
      >
        <button className="s-button" onClick={() => session.refetch()}>
          Повторить
          <Icon name="arrow" />
        </button>
      </EmptyState>
    );
  return <>{children(session.data)}</>;
}
