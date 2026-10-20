import { redirect } from "next/navigation";

// Legacy commerce URL: Sifat v1 is a catalog/contact experience, not checkout.
export default function LegacyCommercePage() {
  redirect("/contact");
}
