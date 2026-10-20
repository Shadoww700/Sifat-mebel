"use client";
import Link from "next/link";
import { Product, money } from "@/lib/commerce/models";
import { localCommerce, useCommerce } from "@/lib/commerce/local-store";
import { resolveCart } from "@/lib/commerce/cart";
import { ProductPhoto } from "./product-image";
import { DemoNotice, EmptyState, SectionHeading } from "./primitives";
import { Icon } from "./icons";

export function Cart({ products }: { products: Product[] }) {
  const { cart } = useCommerce();
  const lines = resolveCart(cart, products);
  const supportedCurrency = lines.every(
    (line) => line.product?.currency === "TJS",
  );
  const valid = lines.every((line) => line.valid) && supportedCurrency;
  const totals = lines.reduce<Record<string, number>>((result, line) => {
    const currency = line.product?.currency ?? "TJS";
    result[currency] = (result[currency] ?? 0) + line.price * line.quantity;
    return result;
  }, {});
  return (
    <>
      <SectionHeading
        eyebrow="Ваш выбор"
        title="Ближе к вашему дому."
        text="Проверьте предметы, количество и варианты исполнения."
      />
      {!lines.length ? (
        <EmptyState
          icon="bag"
          title="Всё начинается с одного предмета"
          text="Ваша корзина пока пуста. Найдите то, что сделает дом немного больше вашим."
        />
      ) : (
        <div className="s-checkout-grid">
          <div>
            <div className="s-cart-lines">
              {lines.map((line) => (
                <article className="s-cart-line" key={line.key}>
                  <Link
                    className="s-cart-image"
                    href={
                      line.product
                        ? `/products/${line.product.slug}`
                        : "/catalog"
                    }
                  >
                    <ProductPhoto
                      src={line.product?.images[0]?.src}
                      alt={line.product?.name ?? "Товар недоступен"}
                      sizes="160px"
                    />
                  </Link>
                  <div className="s-cart-description">
                    <span className="s-kicker">{line.product?.brand}</span>
                    <h2>
                      {line.product ? (
                        <Link href={`/products/${line.product.slug}`}>
                          {line.product.name}
                        </Link>
                      ) : (
                        "Товар больше недоступен"
                      )}
                    </h2>
                    {line.variant && <p>{line.variant.name}</p>}
                    <strong>{money(line.price, line.product?.currency)}</strong>
                    {!line.valid && (
                      <p className="s-error-text">
                        Проверьте наличие и количество или удалите этот предмет.
                      </p>
                    )}
                    <div className="s-quantity">
                      <button
                        className="s-icon-button"
                        disabled={line.quantity <= 1}
                        aria-label={`Уменьшить количество: ${line.product?.name}`}
                        onClick={() =>
                          localCommerce.quantity(line.key, line.quantity - 1)
                        }
                      >
                        <Icon name="minus" />
                      </button>
                      <output aria-label="Количество">{line.quantity}</output>
                      <button
                        className="s-icon-button"
                        disabled={line.quantity >= line.limit}
                        aria-label={`Увеличить количество: ${line.product?.name}`}
                        onClick={() =>
                          localCommerce.quantity(line.key, line.quantity + 1)
                        }
                      >
                        <Icon name="plus" />
                      </button>
                    </div>
                  </div>
                  <div className="s-cart-end">
                    <button
                      className="s-icon-button"
                      aria-label={`Удалить из корзины: ${line.product?.name ?? "товар"}`}
                      onClick={() => localCommerce.remove(line.key)}
                    >
                      <Icon name="close" />
                    </button>
                    <strong>
                      {money(
                        line.price * line.quantity,
                        line.product?.currency,
                      )}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
            <Link className="s-text-link" href="/catalog">
              Продолжить выбирать
              <Icon name="arrow" />
            </Link>
          </div>
          <aside className="s-summary">
            <span className="s-kicker">Ваша корзина</span>
            <h2>Всё сложилось.</h2>
            <dl>
              <div>
                <dt>Предметов</dt>
                <dd>{cart.reduce((sum, l) => sum + l.quantity, 0)}</dd>
              </div>
              <div>
                <dt>Доставка</dt>
                <dd>На следующем шаге</dd>
              </div>
              <div className="s-summary-total">
                <dt>Товары</dt>
                <dd>
                  {Object.entries(totals).map(([currency, total]) => (
                    <div key={currency}>{money(total, currency)}</div>
                  ))}
                </dd>
              </div>
            </dl>
            {valid ? (
              <Link className="s-button s-full" href="/checkout">
                К оформлению
                <Icon name="arrow" />
              </Link>
            ) : (
              <p className="s-error-text" role="alert">
                {supportedCurrency
                  ? "Для продолжения обновите корзину."
                  : "Демооформление доступно только для товаров в сомони. Конвертация валют не выполняется."}
              </p>
            )}
            <DemoNotice checkout />
          </aside>
        </div>
      )}
    </>
  );
}
