"use client";
import { useState } from "react";
import type { Product, Variant } from "@/lib/commerce/models";
import {
  contactSummary,
  storePhone,
  storePhoneHref,
  storeMessageUrl,
  storeTelegramUrl,
  storeWhatsAppUrl,
} from "@/lib/commerce/contact";
import { Drawer } from "./drawer";
import { Icon } from "./icons";

export function ContactCTA({
  product,
  variant,
  compact = false,
  disabled = false,
}: {
  product?: Product;
  variant?: Variant;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const summary = product ? contactSummary(product, variant) : "";
  return (
    <>
      <button
        type="button"
        className={`s-button s-contact-button${compact ? " s-contact-compact" : ""}`}
        disabled={disabled}
        onClick={() => {
          setCopied("");
          setOpen(true);
        }}
      >
        <span>{compact ? "Связаться" : "Связаться с магазином"}</span>
        <Icon name="phone" />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Обсудим детали">
        <p className="s-muted">
          Поможем выбрать исполнение и уточним наличие, цену и доставку.
          Онлайн-оплата не требуется.
        </p>
        {product && (
          <div className="s-contact-summary">
            <span className="s-kicker">Ваш выбор</span>
            <h3>{product.name}</h3>
            <textarea
              aria-label="Информация для менеджера"
              readOnly
              value={summary}
              rows={Math.min(10, summary.split("\n").length + 1)}
            />
            <button
              type="button"
              className="s-text-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(summary);
                  setCopied("Информация скопирована");
                } catch {
                  setCopied(
                    "Не удалось скопировать. Выделите текст выше и скопируйте вручную.",
                  );
                }
              }}
            >
              Скопировать информацию
            </button>
            <p role="status" className="s-muted">
              {copied}
            </p>
          </div>
        )}
        <div className="s-contact-actions">
          {storePhoneHref ? (
            <a className="s-button s-contact-button" href={storePhoneHref}>
              <Icon name="phone" />
              Позвонить · {storePhone}
            </a>
          ) : (
            <p className="s-contact-pending">
              Телефон магазина пока не указан. Сохраните товар в избранном —
              контакт появится здесь после настройки.
            </p>
          )}
          <a
            className="s-button s-button-outline"
            href={storeTelegramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в Telegram
            <Icon name="arrow" />
          </a>
          <a
            className="s-button s-button-outline"
            href={storeWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в WhatsApp
            <Icon name="arrow" />
          </a>
          {storeMessageUrl &&
            storeMessageUrl !== storeTelegramUrl &&
            storeMessageUrl !== storeWhatsAppUrl && (
              <a
                className="s-button s-button-outline"
                href={storeMessageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Написать в магазин
                <Icon name="arrow" />
              </a>
            )}
        </div>
      </Drawer>
    </>
  );
}
