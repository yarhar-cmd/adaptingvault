import type { ReactNode } from 'react';

export function PageContainer({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="page-container">
      <header className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {children}
    </div>
  );
}
