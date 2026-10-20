import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/manrope/700.css";
import "@/styles/store.css";
import "@/styles/admin.css";
import "@/styles/theme.css";
import { readTheme } from "@/lib/theme/server";
import { ThemeSurface } from "@/components/store/theme";
import { adminSource } from "@/lib/commerce/data-source";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Управление — Sifat Mebel",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeSurface className="store admin" initialTheme={await readTheme()}>
      <AdminShell source={adminSource}>{children}</AdminShell>
    </ThemeSurface>
  );
}
