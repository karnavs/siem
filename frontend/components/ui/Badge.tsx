import { Severity, AlertStatus } from '@/lib/types';
import clsx from 'clsx';

const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
  HIGH: 'bg-severity-high/15 text-severity-high border-severity-high/30',
  MEDIUM: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30',
  LOW: 'bg-severity-low/15 text-severity-low border-severity-low/30',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium uppercase tracking-wide',
        SEVERITY_STYLES[severity],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<AlertStatus, string> = {
  OPEN: 'bg-signal-amber/15 text-signal-amber border-signal-amber/30',
  ACKNOWLEDGED: 'bg-signal-cyan/15 text-signal-cyan border-signal-cyan/30',
  RESOLVED: 'bg-status-resolved/15 text-status-resolved border-status-resolved/30',
  FALSE_POSITIVE: 'bg-ink-faint/15 text-ink-muted border-ink-faint/30',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVED: 'Resolved',
  FALSE_POSITIVE: 'False positive',
};

export function StatusBadge({ status }: { status: AlertStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
