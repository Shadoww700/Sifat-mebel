"use client";
import Link from "next/link";
import { useAdminData, AdminHeading, DataState } from "./data";
import { resources, type ResourceKey } from "@/lib/admin/resources";
import { Icon } from "@/components/store/icons";

export function AdminDashboard() {
  const keys: ResourceKey[] = [
    "products",
    "product-variants",
    "categories",
    "stock-movements",
  ];
  const query = useAdminData(keys);
  return (
    <>
      <AdminHeading
        title="Магазин под контролем."
        text="Каталог, характеристики и остатки — отдельно от покупательской витрины."
      >
        <Link className="s-button" href="/admin/products/new">
          Добавить товар
          <Icon name="plus" />
        </Link>
      </AdminHeading>
      {query.isPending ? (
        <DataState loading />
      ) : query.isError ? (
        <DataState error={query.error} retry={() => query.refetch()} />
      ) : (
        <div className="a-stats">
          {keys.map((key) => (
            <Link key={key} href={`/admin/${key}`}>
              <span>{resources[key].title}</span>
              <strong>
                {key === "products"
                  ? (query.data.productPagination?.count ??
                    query.data[key]?.length ??
                    0)
                  : (query.data[key]?.length ?? 0)}
              </strong>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
      )}
      <section className="a-workflow">
        <span className="s-kicker">Порядок наполнения</span>
        <h2>От структуры к предмету.</h2>
        <div>
          <Link href="/admin/categories">
            <span>01</span>
            <h3>Структура</h3>
            <p>Категория, тип товара и бренд.</p>
          </Link>
          <Link href="/admin/products">
            <span>02</span>
            <h3>Содержание</h3>
            <p>Товар, фотографии и характеристики.</p>
          </Link>
          <Link href="/admin/product-variants">
            <span>03</span>
            <h3>Исполнения</h3>
            <p>SKU, опции, цена и скидка.</p>
          </Link>
          <Link href="/admin/stock-adjustments">
            <span>04</span>
            <h3>Остатки</h3>
            <p>Приход или списание с записью в журнале.</p>
          </Link>
        </div>
      </section>
      <div className="a-note">
        <strong>Витрина остаётся покупательской.</strong>
        <p>
          Управление доступно только здесь. Перейти на витрину можно из верхней
          панели.
        </p>
      </div>
    </>
  );
}
