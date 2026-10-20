import Link from "next/link";
import { StoreHeader } from "./header";
import { StoreProvider } from "./store-provider";
import { catalogSource } from "@/lib/commerce/catalog";
import { adminSource } from "@/lib/commerce/data-source";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/manrope/700.css";
import "@/styles/store.css";
import "@/styles/catalog-contact.css";
import "@/styles/theme.css";
import "@/styles/store-ux.css";
import "@/styles/store-refined.css";
import "@/styles/store-polish.css";
import { readTheme } from "@/lib/theme/server";
import { ThemeSurface } from "./theme";

export async function StoreShell({ children }: { children: React.ReactNode }) {
  const initialTheme = await readTheme();
  return (
    <ThemeSurface initialTheme={initialTheme}>
      <StoreProvider adminSource={adminSource} source={catalogSource}>
        <StoreHeader demo={catalogSource === "demo"} />
        <main id="store-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="s-footer">
          <div className="s-container s-footer-grid">
            <div>
              <Link className="s-logo" href="/">
                SIFAT<span>MEBEL</span>
                <i />
              </Link>
              <p>
                Дом, в котором
                <br />
                хочется остаться.
              </p>
            </div>
            <div>
              <span className="s-kicker">Коллекция</span>
              <Link href="/catalog">Все предметы</Link>
              <Link href="/categories">Категории</Link>
              <Link href="/favorites">Избранное</Link>
            </div>
            <div>
              <span className="s-kicker">Ваш Sifat</span>
              <Link href="/account">Личный кабинет</Link>
              <Link href="/addresses">Адреса</Link>
              <Link href="/contact">Связаться с магазином</Link>
            </div>
            <div className="s-footer-note">
              <span className="s-kicker">С вниманием к деталям</span>
              <p>
                Натуральные фактуры.
                <br />
                Выверенные пропорции.
                <br />
                Ваш собственный ритм.
              </p>
            </div>
          </div>
          <div className="s-container s-footer-bottom">
            <span>© {new Date().getFullYear()} Sifat Mebel</span>
            <span>Душанбе · RU / TJS</span>
          </div>
        </footer>
      </StoreProvider>
    </ThemeSurface>
  );
}
