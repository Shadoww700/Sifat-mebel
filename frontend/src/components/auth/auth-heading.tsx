export function AuthHeading({ label, title, children }: { label: string; title: React.ReactNode; children: React.ReactNode }) {
  return <div className="auth-heading"><span className="eyebrow">{label}</span><h1>{title}</h1><p>{children}</p></div>;
}
