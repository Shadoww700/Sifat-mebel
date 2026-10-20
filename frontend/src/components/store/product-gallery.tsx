"use client";
import { useState } from "react";
import type { Product } from "@/lib/commerce/models";
import { ProductPhoto } from "./product-image";
import { Drawer } from "./drawer";
import { Icon } from "./icons";

export function ProductGallery({ product }: { product: Product }) {
  const [image, setImage] = useState(0);
  const [zoom, setZoom] = useState(false);
  const photo = product.images[image];
  return (
    <>
      {" "}
      <section className="s-gallery" aria-label="Галерея товара">
        <button
          className="s-gallery-main"
          disabled={!photo}
          onClick={() => setZoom(true)}
          aria-label="Увеличить фотографию"
        >
          <ProductPhoto
            key={photo?.src}
            src={photo?.src}
            alt={photo?.alt ?? product.name}
            priority
            sizes="(max-width: 767px) 100vw, 60vw"
          />
          <span className="s-gallery-expand">
            <Icon name="plus" />
            Рассмотреть
          </span>
        </button>
        <div className="s-gallery-controls">
          <button
            className="s-icon-button s-prev"
            aria-label="Предыдущая фотография"
            disabled={image === 0}
            onClick={() => setImage((i) => i - 1)}
          >
            <Icon name="arrow" />
          </button>
          <span>
            {product.images.length
              ? `${image + 1} / ${product.images.length}`
              : "Нет фото"}
          </span>
          <button
            className="s-icon-button"
            aria-label="Следующая фотография"
            disabled={image >= product.images.length - 1}
            onClick={() => setImage((i) => i + 1)}
          >
            <Icon name="arrow" />
          </button>
        </div>
        <div className="s-thumbnails">
          {product.images.map((item, i) => (
            <button
              key={item.src}
              className={image === i ? "selected" : ""}
              aria-label={`Фотография ${i + 1}: ${item.alt}`}
              aria-pressed={image === i}
              onClick={() => setImage(i)}
            >
              <ProductPhoto src={item.src} alt="" sizes="90px" />
            </button>
          ))}
        </div>
        {product.source === "demo" && image > 0 && (
          <p className="s-muted">
            Интерьерное настроение коллекции; не дополнительный ракурс товара.
          </p>
        )}
      </section>
      <Drawer open={zoom} onClose={() => setZoom(false)} title={product.name}>
        <div className="s-zoom-image">
          <ProductPhoto
            key={photo?.src}
            src={photo?.src}
            alt={photo?.alt ?? product.name}
            sizes="100vw"
            contain
          />
        </div>
        <div className="s-gallery-controls">
          <button
            className="s-icon-button s-prev"
            aria-label="Предыдущее фото"
            disabled={image === 0}
            onClick={() => setImage((i) => i - 1)}
          >
            <Icon name="arrow" />
          </button>
          <span>
            {product.images.length ? image + 1 : 0} / {product.images.length}
          </span>
          <button
            className="s-icon-button"
            aria-label="Следующее фото"
            disabled={image >= product.images.length - 1}
            onClick={() => setImage((i) => i + 1)}
          >
            <Icon name="arrow" />
          </button>
        </div>
      </Drawer>
    </>
  );
}
