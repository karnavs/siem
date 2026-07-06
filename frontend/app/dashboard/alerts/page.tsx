'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Alert, AlertStatus, Paginated, Severity } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { SeverityBadge, StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

const STATUS_OPTIONS: (AlertStatus | 'ALL')[] = ['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'];
const SEVERITY_OPTIONS: (Severity | 'ALL')[] = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function AlertsPage() {
  const [data, setData] = useState<Paginated<Alert> | null>(null);
  const [status, setStatus] = useState<AlertStatus | 'ALL'>('ALL');
  const [severity, setSeverity] = useState<Severity | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: '50' });
    if (status !== 'ALL') params.set('status', status);
    if (severity !== 'ALL') params.set('severity', severity);

    apiFetch<Paginated<Alert>>(`/api/alerts?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [status, severity]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Alerts</h1>
          <p className="mt-1 text-sm text-ink-muted">Correlated alerts produced by the detection engine.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterGroup label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <FilterGroup label="Severity" value={severity} options={SEVERITY_OPTIONS} onChange={setSeverity} />
      </div>

      <Card>
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : data && data.items.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-base-border text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-medium">Alert</th>
                <th className="px-5 py-3 font-medium">MITRE</th>
                <th className="px-5 py-3 font-medium">Severity</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((alert) => (
                <tr key={alert.id} className="border-b border-base-border last:border-0 hover:bg-base-raised">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/alerts/${alert.id}`} className="font-medium text-ink hover:text-signal-amber">
                      {alert.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                    {alert.mitreTechniqueId ? `${alert.mitreTechniqueId} · ${alert.mitreTechniqueName}` : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={alert.status} />
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                    {new Date(alert.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-sm text-ink-muted">No alerts match these filters.</p>
        )}
      </Card>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="flex gap-1 rounded-lg border border-base-border bg-base-panel p-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              value === opt ? 'bg-signal-amber text-base' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {opt === 'ALL' ? 'All' : opt.replace('_', ' ').toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
