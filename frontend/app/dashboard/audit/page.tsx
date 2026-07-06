'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuditLogEntry, Paginated } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ShieldOff } from 'lucide-react';

export default function AuditTrailPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Paginated<AuditLogEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    apiFetch<Paginated<AuditLogEntry>>('/api/audit?pageSize=50')
      .then(setData)
      .catch((err) => setError(err.message));
  }, [user]);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldOff className="h-8 w-8 text-ink-faint" />
        <p className="text-sm text-ink-muted">Audit trail access is restricted to admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Audit Trail</h1>
        <p className="mt-1 text-sm text-ink-muted">Every privileged action taken in SentryGrid, who did it, and when.</p>
      </div>

      {error && <p className="text-sm text-severity-critical">{error}</p>}

      <Card>
        {!data ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : data.items.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-base-border text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Resource</th>
                <th className="px-5 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.id} className="border-b border-base-border last:border-0 hover:bg-base-raised">
                  <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-ink">{entry.user?.name ?? 'System'}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-base-raised px-2 py-0.5 font-mono text-xs text-signal-cyan">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-muted">{entry.resource ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-muted">{entry.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-sm text-ink-muted">No audit events recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
