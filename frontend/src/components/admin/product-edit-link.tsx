"use client";
import Link from "next/link";
import type { Product } from "@/lib/commerce/models";
import { useStoreAdminSource } from "@/components/store/store-provider";
import { useVerifiedAdmin } from "./admin-entry";
export function ProductEditLink({ product }: { product: Product }) {
  const verified = useVerifiedAdmin();
  const adminSource = useStoreAdminSource();
  if (!verified) return null;
  // IDs in demo and API are separate namespaces; never edit an unrelated row.
  if (adminSource !== product.source)
    return (
      <p className="s-edit-source-warning">
        Для изменения согласуйте режим витрины и управления (Demo/API).
      </p>
    );
  return (
    <Link
      className="s-product-edit"
      href={`/admin/products/${encodeURIComponent(product.id)}`}
      aria-label={`Изменить товар: ${product.name}`}
    >
      Изменить<span>ADMIN</span>
    </Link>
  );
}
