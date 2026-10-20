import { StoreShell } from "@/components/store/shell";
// Django is read at request time, not required while building the frontend.
export const dynamic = "force-dynamic";
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreShell>{children}</StoreShell>;
}
