import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-stage" aria-label="Sifat Mebel">
        <Image src="/images/sifat-auth-interior.png" alt="Интерьер с мебелью из ореха и светлой обивкой" fill priority sizes="(max-width: 767px) 100vw, 58vw" />
        <div className="stage-shade" />
        <Link href="/auth/login" className="stage-brand" aria-label="Sifat Mebel, главная">
          <span className="brand-mark">S</span><span>SIFAT<br />MEBEL</span>
        </Link>
        <div className="stage-copy">
          <span className="eyebrow light">Коллекция · 2026</span>
          <h2>Дом начинается<br />с ощущения.</h2>
          <p>Предметы, в которых материал, пропорция и тишина работают вместе.</p>
        </div>
        <span className="stage-index">01 — Душанбе</span>
      </section>
      <section className="auth-panel">
        <header className="mobile-brand">
          <Link href="/auth/login" className="brand-link"><span className="brand-mark">S</span><span>SIFAT MEBEL</span></Link>
          <span className="edition">EST. 2026</span>
        </header>
        <div className="form-frame">{children}</div>
        <footer className="auth-footer"><span>Мебель с характером</span><span>RU · TJS</span></footer>
      </section>
    </main>
  );
}
