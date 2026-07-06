import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-signal-amber text-base font-semibold hover:bg-signal-amber/90',
  secondary: 'bg-base-raised text-ink border border-base-border hover:bg-base-border',
  ghost: 'text-ink-muted hover:text-ink hover:bg-base-raised',
  danger: 'bg-severity-critical/15 text-severity-critical border border-severity-critical/30 hover:bg-severity-critical/25',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
