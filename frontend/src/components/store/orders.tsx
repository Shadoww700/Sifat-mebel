"use client";

import Link from "next/link";
import { useCommerce } from "@/lib/commerce/local-store";
import { money, type Order } from "@/lib/commerce/models";
import { SectionHeading, EmptyState, DemoNotice } from "./primitives";
import { ProductPhoto } from "./product-image";
import { Icon } from "./icons";

const labels: Record<Order["status"], string> = {
  created: "Сохранён",
  preparing: "Готовится",
  delivered: "Получен",
};
const total = (order: Order) =>
  order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    order.deliveryPrice,
  );
const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dushanbe",
  }).format(new Date(value));

/** Local preview only. No order API endpoint exists and none is called here. */
export function OrdersScreen() {
  const { orders } = useCommerce();
  return (
    <>
      <SectionHeading
        eyebrow="Ваша история"
        title="Мои заказы."
        text="Здесь видны только демонстрационные заказы, сохранённые в этом браузере."
      />
      {orders.length ? (
        <div className="s-order-list">
          {orders.map((order) => (
            <article className="s-order-card" key={order.id}>
              <div className="s-order-card-top">
                <div>
                  <h2>
                    <Link href={`/orders/${order.id}`}>{order.id}</Link>
                  </h2>
                  <time dateTime={order.createdAt}>
                    {date(order.createdAt)}
                  </time>
                </div>
                <span className="s-tag">Демо · {labels[order.status]}</span>
              </div>
              <div className="s-order-card-bottom">
                <div className="s-order-thumbs">
                  {order.items.slice(0, 3).map((item) => (
                    <div key={item.key}>
                      <ProductPhoto
                        src={item.image}
                        alt={item.name}
                        sizes="62px"
                      />
                    </div>
                  ))}
                </div>
                <strong>{money(total(order))}</strong>
                <Link
                  className="s-icon-button"
                  href={`/orders/${order.id}`}
                  aria-label={`Открыть заказ ${order.id}`}
                >
                  <Icon name="arrow" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="box"
          title="Впереди — ваша первая история"
          text="Сохраните пробный заказ из корзины, чтобы посмотреть, как будет выглядеть этот раздел."
        />
      )}
      <DemoNotice checkout />
    </>
  );
}

export function OrderDetail({ id, created }: { id: string; created: boolean }) {
  const { orders } = useCommerce();
  const order = orders.find((item) => item.id === id);
  if (!order)
    return (
      <EmptyState
        title="Заказ не найден"
        text="Демонстрационные заказы доступны только в браузере, где вы их сохранили."
        href="/orders"
        action="К моим заказам"
      />
    );
  return (
    <>
      {created && (
        <div className="s-order-success" role="status">
          <Icon name="check" />
          <p>
            Демонстрационный заказ сохранён. Оплата и доставка не выполняются.
          </p>
        </div>
      )}
      <SectionHeading
        eyebrow={`Заказ ${order.id}`}
        title="Всё на своих местах."
        text={`${date(order.createdAt)} · Демонстрационный заказ`}
      />
      <ol
        className="s-timeline"
        aria-label="Состояние демонстрационного заказа"
      >
        {(["created", "preparing", "delivered"] as const).map(
          (status, index) => (
            <li
              className={status === order.status ? "current" : ""}
              aria-current={status === order.status ? "step" : undefined}
              key={status}
            >
              <span>
                0{index + 1} / {labels[status]}
              </span>
            </li>
          ),
        )}
      </ol>
      <div className="s-checkout-grid">
        <div>
          <div className="s-cart-lines">
            {order.items.map((item) => (
              <article className="s-cart-line" key={item.key}>
                <div className="s-cart-image">
                  <ProductPhoto
                    src={item.image}
                    alt={item.name}
                    sizes="150px"
                  />
                </div>
                <div className="s-cart-description">
                  <h2>{item.name}</h2>
                  {item.variant && <p>{item.variant}</p>}
                  <p>
                    {item.quantity} шт. × {money(item.price)}
                  </p>
                  <strong>{money(item.quantity * item.price)}</strong>
                </div>
              </article>
            ))}
          </div>
          <div className="s-order-address">
            <h2>
              {order.delivery === "pickup" ? "Самовывоз" : "Адрес получения"}
            </h2>
            <p>
              {order.address.recipient} · {order.address.phone}
            </p>
            {order.delivery === "delivery" ? (
              <p>
                {[
                  order.address.city,
                  order.address.street,
                  `д. ${order.address.house}`,
                  order.address.apartment && `кв. ${order.address.apartment}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : (
              <p>
                Место получения будет доступно при запуске реального оформления.
              </p>
            )}
          </div>
        </div>
        <aside className="s-summary">
          <span className="s-kicker">Детали</span>
          <h2>Ваш заказ.</h2>
          <dl>
            <div>
              <dt>Предметов</dt>
              <dd>
                {order.items.reduce((sum, item) => sum + item.quantity, 0)}
              </dd>
            </div>
            <div>
              <dt>Демодоставка</dt>
              <dd>{money(order.deliveryPrice)}</dd>
            </div>
            <div className="s-summary-total">
              <dt>Итого</dt>
              <dd>{money(total(order))}</dd>
            </div>
          </dl>
          <span className="s-tag">Без оплаты</span>
          <DemoNotice checkout />
        </aside>
      </div>
      <div className="s-form-actions">
        <Link className="s-text-link" href="/orders">
          Все заказы
          <Icon name="arrow" />
        </Link>
        <Link className="s-text-link" href="/catalog">
          Продолжить выбирать
          <Icon name="arrow" />
        </Link>
      </div>
    </>
  );
}
