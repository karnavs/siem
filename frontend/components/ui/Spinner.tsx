import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx('h-5 w-5 animate-spin rounded-full border-2 border-base-border border-t-signal-amber', className)}
      role="status"
      aria-label="Loading"
    />
  );
}
