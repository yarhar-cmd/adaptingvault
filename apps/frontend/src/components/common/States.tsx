export function LoadingState({ label = 'The vault is listening…' }: { label?: string }) {
  return <p className="state state--loading">{label}</p>;
}

export function EmptyState({ children }: { children: string }) {
  return <p className="state">{children}</p>;
}

export function ErrorState({ children }: { children: string }) {
  return (
    <p className="state state--error" role="alert">
      {children}
    </p>
  );
}
