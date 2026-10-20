"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFavorites } from "@/lib/commerce/favorites";
import { useFavoriteCollection } from "@/lib/commerce/favorites-provider";
import { Drawer } from "./drawer";
import { Icon } from "./icons";
import { AdminEntry } from "@/components/admin/admin-entry";
import { ThemeToggle } from "./theme";

export function StoreHeader({ demo }: { demo: boolean }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const favorites = useFavorites().filter((key) =>
    key.startsWith(demo ? "demo:" : "api:"),
  );
  const favoriteState = useFavoriteCollection().status;
  const favoriteLabel =
    favoriteState === "ready"
      ? `Избранное: ${favorites.length}`
      : favoriteState === "guest"
        ? "Избранное: требуется вход"
        : favoriteState === "loading"
          ? "Избранное: загрузка"
          : favoriteState === "demo"
            ? "Избранное: недоступно в Demo"
            : "Избранное: ошибка загрузки";
  const links = [
    { href: "/catalog", name: "Каталог" },
    { href: "/categories", name: "Категории" },
    { href: "/contact", name: "Контакты" },
  ];
  return (
    <>
      <a className="s-skip" href="#store-content">
        Перейти к содержимому
      </a>
      <div className="s-topline">
        <span>Продуманные предметы. Тёплый дом.</span>
        <span>
          {demo ? "Демонстрационная коллекция" : "Душанбе · Таджикистан"}
        </span>
      </div>
      <header className="s-header">
        <div className="s-header-inner">
          <button
            className="s-icon-button s-menu-toggle"
            aria-label="Открыть меню"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Icon name="menu" />
          </button>
          <Link className="s-logo" href="/" aria-label="Sifat Mebel, главная">
            SIFAT<span>MEBEL</span>
            <i />
          </Link>
          <nav className="s-desktop-nav" aria-label="Основная навигация">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.name}
              </Link>
            ))}
          </nav>
          {!pathname.startsWith("/catalog") && pathname !== "/search" && (
            <form className="s-header-search" action="/search" role="search">
              <label className="s-visually-hidden" htmlFor="header-search">
                Поиск товаров
              </label>
              <input
                id="header-search"
                name="q"
                type="search"
                placeholder="Найти мебель"
              />
              <button
                className="s-icon-button"
                type="submit"
                aria-label="Найти товар"
              >
                <Icon name="search" />
              </button>
            </form>
          )}
          <nav className="s-header-actions" aria-label="Личные разделы">
            <ThemeToggle />
            <AdminEntry compact />
            <Link
              className="s-icon-button s-search-shortcut"
              href="/search"
              aria-label="Поиск"
            >
              <Icon name="search" />
            </Link>
            <Link
              className="s-icon-button s-desktop-action"
              href="/account"
              aria-label="Личный кабинет"
            >
              <Icon name="user" />
            </Link>
            <Link
              className="s-icon-button s-desktop-action"
              href="/favorites"
              aria-label={favoriteLabel}
            >
              <Icon name="heart" />
              {favorites.length > 0 && (
                <span className="s-counter">{favorites.length}</span>
              )}
            </Link>
          </nav>
        </div>
      </header>
      <Drawer open={menu} onClose={() => setMenu(false)} title="Sifat Mebel">
        <nav className="s-menu-links" aria-label="Мобильное меню">
          <AdminEntry onNavigate={() => setMenu(false)} />
          {[
            ...links,
            { href: "/favorites", name: "Избранное" },
            { href: "/account", name: "Личный кабинет" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenu(false)}
            >
              {link.name}
              <Icon name="arrow" />
            </Link>
          ))}
        </nav>
        <p className="s-muted">Предметы для вашей истории.</p>
      </Drawer>
      <nav className="s-mobile-bar" aria-label="Быстрая навигация">
        {[
          { href: "/catalog", title: "Каталог", icon: "menu" as const },
          { href: "/favorites", title: "Избранное", icon: "heart" as const },
          { href: "/contact", title: "Контакты", icon: "phone" as const },
          { href: "/account", title: "Профиль", icon: "user" as const },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
