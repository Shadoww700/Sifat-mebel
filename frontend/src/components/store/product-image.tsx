"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "./icons";

export function ProductPhoto({
  src,
  alt,
  sizes = "(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 25vw",
  priority = false,
  contain = false,
}: {
  src?: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.startsWith("http")}
      className={contain ? "s-photo contain" : "s-photo"}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className="s-photo-fallback"
      role="img"
      aria-label={`${alt}: фотография пока недоступна`}
    >
      <Icon name="box" />
      <span>Фото появится скоро</span>
    </div>
  );
}
