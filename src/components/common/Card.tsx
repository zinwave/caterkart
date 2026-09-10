import type { HTMLAttributes, ReactNode } from 'react';

/**
 * The one card used across /create and /work — single source of truth for the
 * card design. Pass `hover` for the interactive lift/shadow. (Existing pages use
 * the `.card` class directly; both resolve to the same styles.)
 */
export function Card({
  children,
  className = '',
  hover = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}
