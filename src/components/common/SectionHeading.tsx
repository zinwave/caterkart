import type { ReactNode } from 'react';

/** The one section heading (accent bar + tracked caps) shared by both apps. */
export function SectionHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`section-title ${className}`}>{children}</div>;
}
