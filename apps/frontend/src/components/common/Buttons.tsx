import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function PrimaryButton({ children, className = '', ...props }: ButtonProps) {
  return (
    <button className={`button button--primary ${className}`} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }: ButtonProps) {
  return (
    <button className={`button button--secondary ${className}`} {...props}>
      {children}
    </button>
  );
}
