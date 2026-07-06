import { ReactNode } from 'react';
import { Card } from './Card';
import clsx from 'clsx';

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: 'default' | 'critical' | 'amber';
}) {
  const toneText = {
    default: 'text-ink',
    critical: 'text-severity-critical',
    amber: 'text-signal-amber',
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</p>
          <p className={clsx('mt-2 font-display text-3xl font-semibold tabular-nums', toneText)}>{value}</p>
        </div>
        {icon && <div className="text-ink-faint">{icon}</div>}
      </div>
    </Card>
  );
}
