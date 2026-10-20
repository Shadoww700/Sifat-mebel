import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons";

export function SuccessState({ eyebrow = "Готово", title, text, href = "/auth/login", action = "Войти в аккаунт" }: { eyebrow?: string; title: string; text: string; href?: string; action?: string }) {
  return <div className="success-state page-enter"><span className="success-mark"><CheckIcon /></span><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p><Link className="submit-button success-link" href={href}><span>{action}</span><span>→</span></Link></div>;
}
