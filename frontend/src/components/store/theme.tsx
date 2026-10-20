"use client";
import { createContext, useContext, useState } from "react";
import { Icon } from "./icons";
type Theme = "day" | "evening";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(
  null,
);
export function ThemeSurface({
  initialTheme,
  className = "store",
  children,
}: {
  initialTheme: Theme;
  className?: string;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);
  function toggle() {
    const next = theme === "day" ? "evening" : "day";
    document.cookie = `sifat-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setTheme(next);
  }
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <div className={className} data-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) return null;
  const label =
    context.theme === "day"
      ? "Включить вечерний режим"
      : "Включить дневной режим";
  return (
    <button
      type="button"
      className="s-icon-button s-theme-toggle"
      onClick={context.toggle}
      aria-label={label}
      title={label}
      aria-pressed={context.theme === "evening"}
    >
      <Icon name={context.theme === "day" ? "moon" : "sun"} />
    </button>
  );
}
