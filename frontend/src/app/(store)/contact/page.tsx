import Link from "next/link";
import { Breadcrumbs, SectionHeading } from "@/components/store/primitives";
import { ContactCTA } from "@/components/store/contact-cta";
import { Icon } from "@/components/store/icons";
import {
  storePhone,
  storePhoneHref,
  storeTelegramUrl,
  storeWhatsAppUrl,
} from "@/lib/commerce/contact";

export const metadata = { title: "Контакты — Sifat Mebel" };
export default function ContactPage() {
  return (
    <div className="s-container s-page s-contact-view">
      <Breadcrumbs items={[{ label: "Контакты" }]} />
      <SectionHeading
        eyebrow="Sifat · Личный подход"
        title="Давайте обсудим."
        text="Позвоните или напишите нам. Обсудим понравившуюся мебель, её исполнение, наличие и доставку."
      />
      <div className="s-contact-page">
        <section className="s-contact-panel">
          <span className="s-kicker">Связь с магазином</span>
          <h2>Внимание к вашему выбору.</h2>
          {storePhoneHref ? (
            <a className="s-contact-number" href={storePhoneHref}>
              {storePhone}
            </a>
          ) : (
            <p>
              Телефон магазина пока не указан. Здесь появятся контакты после
              настройки.
            </p>
          )}
          <div className="s-contact-actions">
            <a
              className="s-button s-button-outline"
              href={storeTelegramUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram · @sifat_mebel_sklad
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
            <ContactCTA />
          </div>
        </section>
        <section className="s-contact-steps" aria-label="Как выбрать товар">
          <h2>От выбора — к деталям.</h2>
          <div>
            <span>01</span>
            <h3>Найдите своё</h3>
            <p>Посмотрите коллекцию, сравните характеристики и варианты.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Сохраните выбор</h3>
            <p>
              Добавьте предмет в избранное. В карточке можно скопировать его
              артикул и характеристики.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Обсудим детали</h3>
            <p>
              Сообщите менеджеру артикул — уточним цену, наличие и удобный
              способ получения.
            </p>
          </div>
          <Link className="s-text-link" href="/favorites">
            Моё избранное
            <Icon name="heart" />
          </Link>
        </section>
      </div>
    </div>
  );
}
