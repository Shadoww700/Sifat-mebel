import { notFound } from "next/navigation";
import { ProductWorkspace } from "@/components/admin/product-workspace";
export default async function ProductManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) notFound();
  return <ProductWorkspace key={productId} productId={productId} />;
}
