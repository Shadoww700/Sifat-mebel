import { Breadcrumbs } from "@/components/store/primitives";
import { AccountShell } from "@/components/store/account-shell";
import { ProfileScreen } from "@/components/store/profile";
export const metadata = { title: "Профиль — Sifat Mebel" };
export default function AccountPage() {
  return (
    <div className="s-container s-page">
      <Breadcrumbs items={[{ label: "Личный кабинет" }]} />
      <AccountShell>
        <ProfileScreen />
      </AccountShell>
    </div>
  );
}
