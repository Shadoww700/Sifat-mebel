import { Breadcrumbs } from "@/components/store/primitives";
import { AccountShell } from "@/components/store/account-shell";
import { AddressesScreen } from "@/components/store/addresses";
export const metadata = { title: "Адреса — Sifat Mebel" };
export default function AddressesPage() {
  return (
    <div className="s-container s-page">
      <Breadcrumbs
        items={[
          { label: "Личный кабинет", href: "/account" },
          { label: "Адреса" },
        ]}
      />
      <AccountShell>
        <AddressesScreen />
      </AccountShell>
    </div>
  );
}
