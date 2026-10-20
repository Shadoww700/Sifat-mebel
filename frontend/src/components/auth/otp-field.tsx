"use client";

import { useId, useRef } from "react";

export function OtpField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const id = useId();
  const digits = Array.from({ length: 6 }, (_, i) => value[i]?.trim() ?? "");
  function replace(index: number, raw: string) {
    const input = raw.replace(/\D/g, "").slice(0, 6);
    const next = Array.from({ length: 6 }, (_, i) => digits[i] || " ");
    if (!input) next[index] = " ";
    else
      for (
        let offset = 0;
        offset < input.length && index + offset < 6;
        offset++
      )
        next[index + offset] = input[offset];
    onChange(next.join("").trimEnd());
    if (input) refs.current[Math.min(index + input.length, 5)]?.focus();
  }
  return (
    <div className="otp-group">
      <div className="otp-label">
        <label htmlFor={id + "-0"}>Код подтверждения</label>
        <span>{digits.filter(Boolean).length}/6</span>
      </div>
      <div className="otp-inputs">
        {digits.map((digit, index) => (
          <input
            key={index}
            id={id + "-" + index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            value={digit}
            onChange={(event) => replace(index, event.target.value)}
            onFocus={(event) => event.target.select()}
            onPaste={(event) => {
              const next = event.clipboardData
                .getData("text")
                .replace(/\D/g, "")
                .slice(0, 6);
              if (next) {
                event.preventDefault();
                replace(next.length === 6 ? 0 : index, next);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                const at = !digit && index > 0 ? index - 1 : index;
                replace(at, "");
                refs.current[at]?.focus();
              }
              if (event.key === "ArrowLeft" && index > 0) {
                event.preventDefault();
                refs.current[index - 1]?.focus();
              }
              if (event.key === "ArrowRight" && index < 5) {
                event.preventDefault();
                refs.current[index + 1]?.focus();
              }
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={6}
            disabled={disabled}
            aria-label={"Цифра " + (index + 1)}
            aria-invalid={!!error}
            aria-describedby={error ? id + "-error" : undefined}
          />
        ))}
      </div>
      {error && (
        <span id={id + "-error"} className="field-message" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
