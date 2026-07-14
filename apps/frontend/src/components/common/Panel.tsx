import type { ReactNode } from 'react';

export function Panel({
  children,
  className = '',
  eyebrow,
}: {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      {children}
    </section>
  );
}
