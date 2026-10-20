type IconProps = { className?: string };

export function EyeIcon({ open = true }: IconProps & { open?: boolean }) {
  return open ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16M9.9 6.8c.7-.2 1.4-.3 2.1-.3 6.1 0 9.5 5.5 9.5 5.5a17 17 0 0 1-2.8 3.4M6.4 8.3A17.5 17.5 0 0 0 2.5 12s3.4 5.5 9.5 5.5c1 0 1.9-.1 2.7-.4M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6"/></svg>;
}

export function ArrowIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 6l6 6-6 6"/></svg>; }
export function CheckIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>; }
