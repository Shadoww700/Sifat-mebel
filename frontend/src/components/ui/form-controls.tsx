"use client";

import { forwardRef, InputHTMLAttributes, useState } from "react";
import { EyeIcon } from "./icons";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const Field = forwardRef<HTMLInputElement, InputProps>(function Field({ label, error, type, id, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={`field ${error ? "field-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input ref={ref} id={id} type={isPassword && visible ? "text" : type} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />
        {isPassword && <button type="button" className="eye-button" onClick={() => setVisible(v => !v)} aria-label={visible ? "Скрыть пароль" : "Показать пароль"}><EyeIcon open={!visible} /></button>}
      </div>
      {error && <span id={`${id}-error`} className="field-message" role="alert">{error}</span>}
    </div>
  );
});

export function FormError({ message }: { message?: string }) {
  return message ? <div className="form-error" role="alert"><span aria-hidden="true">!</span>{message}</div> : null;
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <button className="submit-button" type="submit" disabled={pending}><span>{pending ? "Пожалуйста, подождите" : children}</span><span className={pending ? "spinner" : "button-arrow"} aria-hidden="true">{pending ? "" : "→"}</span></button>;
}
