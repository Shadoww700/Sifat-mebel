import { getProduct } from "@/lib/commerce/catalog";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id))
    return Response.json({ detail: "Неверный ID" }, { status: 400 });
  try {
    // Public Django request only: never forward a user's staff token into the storefront.
    const product = await getProduct(id);
    return Response.json(product, {
      status: product ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { detail: "Не удалось загрузить товар" },
      { status: 502 },
    );
  }
}
