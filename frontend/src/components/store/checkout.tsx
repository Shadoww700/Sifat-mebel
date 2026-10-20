"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Product, money, type Order } from "@/lib/commerce/models";
import { localCommerce, useCommerce } from "@/lib/commerce/local-store";
import { resolveCart } from "@/lib/commerce/cart";
import { Field, FormError } from "@/components/ui/form-controls";
import { DemoNotice, EmptyState, SectionHeading } from "./primitives";
import { Icon } from "./icons";

const schema = z
  .object({
    recipient: z.string().trim().min(2, "Укажите имя получателя").max(100),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{7,20}$/, "Укажите корректный телефон")
      .refine(
        (value) => value.replace(/\D/g, "").length >= 7,
        "Укажите корректный телефон",
      ),
    delivery: z.enum(["delivery", "pickup"]),
    city: z.string().trim().max(100),
    street: z.string().trim().max(255),
    house: z.string().trim().max(50),
    apartment: z.string().trim().max(50),
  })
  .superRefine((values, ctx) => {
    if (values.delivery === "delivery")
      for (const key of ["city", "street", "house"] as const)
        if (!values[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Заполните поле для доставки",
          });
  });
type Values = z.infer<typeof schema>;
export function Checkout({ products }: { products: Product[] }) {
  const router = useRouter();
  const { cart } = useCommerce();
  const locked = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      recipient: "",
      phone: "",
      delivery: "delivery",
      city: "Душанбе",
      street: "",
      house: "",
      apartment: "",
    },
  });
  const delivery = useWatch({ control: form.control, name: "delivery" });
  const lines = resolveCart(cart, products);
  const subtotal = lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  const deliveryPrice = delivery === "delivery" ? 150 : 0;
  const submit = (values: Values) => {
    if (locked.current) return;
    if (
      !lines.length ||
      lines.some((line) => !line.valid || line.product?.currency !== "TJS")
    ) {
      form.setError("root", {
        message: "Корзина изменилась. Проверьте наличие и количество товаров.",
      });
      return;
    }
    locked.current = true;
    setSubmitting(true);
    const id = `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const order: Order = {
      id,
      createdAt: new Date().toISOString(),
      status: "created",
      source: "demo",
      delivery: values.delivery,
      address: values,
      deliveryPrice,
      items: lines.map((line) => ({
        key: line.key,
        name: line.product!.name,
        variant: line.variant?.name ?? "",
        image: line.product!.images[0]?.src ?? "",
        price: line.price,
        quantity: line.quantity,
      })),
    };
    localCommerce.placeDemoOrder(order);
    router.push(`/orders/${id}?created=1`);
  };
  if (!cart.length && !submitting)
    return (
      <EmptyState
        icon="bag"
        title="Сначала выберем предметы"
        text="Добавьте мебель в корзину, чтобы перейти к оформлению."
      />
    );
  if (lines.some((line) => line.product?.currency !== "TJS"))
    return (
      <EmptyState
        title="Проверьте валюту корзины"
        text="Демооформление поддерживает только сомони и не конвертирует цены."
        href="/cart"
        action="Вернуться в корзину"
      />
    );
  return (
    <>
      <SectionHeading
        eyebrow="Последние детали"
        title="Почти дома."
        text="Контактные данные и удобный способ получения."
      />
      <p className="s-checkout-disclaimer" role="note">
        Демооформление: заказ останется только в этом браузере. Не вводите
        реальные персональные данные. Оплата и доставка не выполняются.
      </p>
      <div className="s-checkout-grid">
        <form
          id="checkout-form"
          className="s-commerce-form"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
          noValidate
        >
          <section className="s-form-section">
            <h2>
              <span>01</span>Получатель
            </h2>
            <div className="s-form-grid">
              <Field
                id="recipient"
                label="Имя получателя"
                autoComplete="name"
                error={form.formState.errors.recipient?.message}
                {...form.register("recipient")}
              />
              <Field
                id="phone"
                label="Телефон"
                type="tel"
                autoComplete="tel"
                placeholder="+992"
                error={form.formState.errors.phone?.message}
                {...form.register("phone")}
              />
            </div>
          </section>
          <section className="s-form-section">
            <h2>
              <span>02</span>Получение
            </h2>
            <fieldset className="s-delivery-options">
              <legend className="s-visually-hidden">Способ получения</legend>
              <label className={delivery === "delivery" ? "selected" : ""}>
                <input
                  type="radio"
                  value="delivery"
                  {...form.register("delivery")}
                />
                <Icon name="truck" />
                <span>
                  Доставка<small>Демотариф · 150 сомони</small>
                </span>
              </label>
              <label className={delivery === "pickup" ? "selected" : ""}>
                <input
                  type="radio"
                  value="pickup"
                  {...form.register("delivery")}
                />
                <Icon name="location" />
                <span>
                  Самовывоз<small>Без стоимости доставки</small>
                </span>
              </label>
            </fieldset>
            {delivery === "delivery" ? (
              <div className="s-form-grid">
                <Field
                  id="city"
                  label="Город"
                  autoComplete="address-level2"
                  error={form.formState.errors.city?.message}
                  {...form.register("city")}
                />
                <Field
                  id="street"
                  label="Улица"
                  autoComplete="address-line1"
                  error={form.formState.errors.street?.message}
                  {...form.register("street")}
                />
                <Field
                  id="house"
                  label="Дом"
                  error={form.formState.errors.house?.message}
                  {...form.register("house")}
                />
                <Field
                  id="apartment"
                  label="Квартира · необязательно"
                  {...form.register("apartment")}
                />
              </div>
            ) : (
              <p className="s-info-panel">
                Это демонстрация самовывоза. Адрес и время реального получения
                будут доступны после запуска оформления.
              </p>
            )}
          </section>
          <section className="s-form-section">
            <h2>
              <span>03</span>Без оплаты
            </h2>
            <p>
              Вы можете сохранить пробный заказ и посмотреть его в разделе
              заказов. Деньги не списываются, доставка не оформляется.
            </p>
          </section>
          <FormError message={form.formState.errors.root?.message} />
        </form>
        <aside className="s-summary">
          <span className="s-kicker">Ваш выбор</span>
          <h2>Детали заказа.</h2>
          <ul className="s-summary-items">
            {lines.map((line) => (
              <li key={line.key}>
                <span>
                  {line.product?.name}
                  <small>
                    {line.variant?.name} · {line.quantity} шт.
                  </small>
                </span>
                <strong>{money(line.price * line.quantity)}</strong>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Товары</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            <div>
              <dt>Демодоставка</dt>
              <dd>{deliveryPrice ? money(deliveryPrice) : "Без доплаты"}</dd>
            </div>
            <div className="s-summary-total">
              <dt>Итого</dt>
              <dd>{money(subtotal + deliveryPrice)}</dd>
            </div>
          </dl>
          <button
            form="checkout-form"
            type="submit"
            className="s-button s-full"
            disabled={submitting}
          >
            {submitting ? "Сохраняем…" : "Сохранить демозаказ"}
            <Icon name="arrow" />
          </button>
          <DemoNotice checkout />
        </aside>
      </div>
    </>
  );
}
