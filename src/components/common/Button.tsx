import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'soft' | 'ghost';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  soft: 'btn-secondary',
  ghost: 'btn-ghost',
};

/**
 * The one button used across /create and /work. Variants map to the shared
 * button classes so personal and corporate render identically. Open for
 * extension (add a variant) without touching call sites (SOLID / OCP).
 */
export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${VARIANT_CLASS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
