"use client";
import { createContext, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { checkStaffAccess } from "@/lib/admin/access";
import { apiAdminAdapter, type AdminAdapter } from "@/lib/admin/api";
import { createMockAdminAdapter } from "@/lib/admin/mock";
import { resources, type AdminSource } from "@/lib/admin/resources";
import type { User } from "@/lib/auth/types";
import { Drawer } from "@/components/store/drawer";
import { Icon } from "@/components/store/icons";
import { ThemeToggle } from "@/components/store/theme";

type AdminContextValue = {
  user: User;
  source: AdminSource;
  adapter: AdminAdapter;
  run: <T>(action: () => Promise<T>) => Promise<T>;
};
const AdminContext = createContext<AdminContextValue | null>(null);
export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("Admin context requires verified ADMIN access");
  return context;
}
export function AdminShell({
  children,
  source,
}: {
  children: React.ReactNode;
  source: AdminSource;
}) {
  const pathname = usePathname();
  const access = useQuery({
    queryKey: ["admin-access", pathname],
    queryFn: checkStaffAccess,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });
  if (access.isPending)
    return (
      <div className="a-access" role="status">
        <span className="s-kicker">Sifat · Management</span>
        <h1>Проверяем доступ</h1>
        <p>Подтверждаем сессию и права администратора.</p>
        <div className="s-skeleton s-skeleton-line" />
      </div>
    );
  if (access.isError) {
    const status = access.error instanceof ApiError ? access.error.status : 0;
    return (
      <div className="a-access">
        <span className="s-kicker">Sifat · Management</span>
        <h1>
          {status === 401
            ? "Войдите в аккаунт"
            : status === 403
              ? "Доступ ограничен"
              : "Не удалось проверить доступ"}
        </h1>
        <p>
          {status === 401
            ? "Для управления магазином нужна подтверждённая сессия администратора."
            : status === 403
              ? "Этот раздел доступен только роли ADMIN с подтверждённым доступом backend. Пользовательская и неиспользуемая роль MANAGER не дают доступа к управлению."
              : "Проверка прав недоступна. Управление закрыто до успешной проверки; деморежим не обходит авторизацию."}
        </p>
        <div className="a-actions">
          <Link
            className="s-button"
            href={status === 401 ? "/auth/login" : "/"}
          >
            {status === 401 ? "Войти" : "На витрину"}
            <Icon name="arrow" />
          </Link>
          <button className="s-text-button" onClick={() => access.refetch()}>
            Проверить снова
          </button>
        </div>
      </div>
    );
  }
  return (
    <VerifiedAdmin
      key={`${access.data.id}:${source}`}
      user={access.data}
      source={source}
    >
      {children}
    </VerifiedAdmin>
  );
}
function VerifiedAdmin({
  user,
  source,
  children,
}: {
  user: User;
  source: AdminSource;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const client = useQueryClient();
  const [menu, setMenu] = useState(false);
  const adapter = useMemo(
    () =>
      source === "api" ? apiAdminAdapter : createMockAdminAdapter(user.id),
    [source, user.id],
  );
  const run: AdminContextValue["run"] = async (action) => {
    try {
      const current = await checkStaffAccess();
      if (current.id !== user.id)
        throw new ApiError(403, {
          detail: "Сессия изменилась. Откройте раздел заново.",
        });
      const result = await action();
      await client.invalidateQueries({
        queryKey: ["admin-data", source, user.id],
      });
      return result;
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status))
        await client.invalidateQueries({ queryKey: ["admin-access"] });
      throw error;
    }
  };
  const nav = (mobile = false) => (
    <nav aria-label={mobile ? "Меню управления" : "Разделы управления"}>
      <Link
        href="/admin"
        onClick={() => setMenu(false)}
        aria-current={pathname === "/admin" ? "page" : undefined}
      >
        Обзор
      </Link>
      <span className="a-nav-label">Каталог и структура</span>
      {Object.entries(resources).map(([key, resource]) => (
        <Link
          key={key}
          href={`/admin/${key}`}
          aria-current={pathname === `/admin/${key}` ? "page" : undefined}
          onClick={() => setMenu(false)}
        >
          {resource.title}
        </Link>
      ))}
      <Link
        href="/admin/stock-adjustments"
        aria-current={
          pathname === "/admin/stock-adjustments" ? "page" : undefined
        }
        onClick={() => setMenu(false)}
      >
        Корректировка остатков
      </Link>
    </nav>
  );
  return (
    <AdminContext.Provider value={{ user, source, adapter, run }}>
      <a className="s-skip" href="#admin-content">
        К содержимому управления
      </a>
      <header className="a-header">
        <button
          className="s-icon-button a-menu-button"
          aria-label="Открыть меню управления"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          <Icon name="menu" />
        </button>
        <Link href="/admin" className="a-brand">
          SIFAT<span>Управление</span>
        </Link>
        <div className="a-header-end">
          <ThemeToggle />
          <span className="a-role">Администратор</span>
          <Link className="a-store-link" href="/">
            На витрину
            <Icon name="arrow" />
          </Link>
        </div>
      </header>
      <div className="a-layout">
        <aside className="a-sidebar">
          {nav()}
          <div className="a-identity">
            <strong>{user.first_name || "Сотрудник"}</strong>
            <span>{user.email}</span>
            <Link href="/account">Профиль и выход</Link>
          </div>
        </aside>
        <main id="admin-content" tabIndex={-1} className="a-main">
          <div
            className={`a-source ${source === "demo" ? "a-source-demo" : ""}`}
            role="note"
          >
            <span className="s-dot" />
            <div>
              <strong>
                {source === "demo"
                  ? "Демонстрационное управление"
                  : "Рабочий каталог · Django API"}
              </strong>
              <p>
                {source === "demo"
                  ? "Изменения только в этой вкладке, отдельно от витрины. В Django и PostgreSQL ничего не записывается."
                  : "Сохранение и удаление изменяют реальные данные магазина. Все разрешения проверяет backend."}
              </p>
            </div>
          </div>
          {children}
        </main>
      </div>
      <Drawer
        open={menu}
        onClose={() => setMenu(false)}
        title="Управление магазином"
      >
        {nav(true)}
        <Link
          className="s-text-link"
          href="/account"
          onClick={() => setMenu(false)}
        >
          Профиль и выход
        </Link>
      </Drawer>
    </AdminContext.Provider>
  );
}
