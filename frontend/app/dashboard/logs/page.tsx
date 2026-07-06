'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { SecurityEvent, Paginated } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Search } from 'lucide-react';

export default function LogExplorerPage() {
  const [data, setData] = useState<Paginated<SecurityEvent> | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: '50' });
    if (appliedSearch) params.set('search', appliedSearch);
    apiFetch<Paginated<SecurityEvent>>(`/api/logs?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [appliedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Log Explorer</h1>
        <p className="mt-1 text-sm text-ink-muted">Raw security events ingested from connected sources.</p>
      </div>

      <form onSubmit={onSearch} className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search raw message…"
            className="w-full rounded-lg border border-base-border bg-base-panel py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal-amber focus:outline-none"
          />
        </div>
      </form>

      <Card>
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : data && data.items.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-base-border text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Host</th>
                <th className="px-5 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {data.items.map((event) => (
                <tr key={event.id} className="border-b border-base-border last:border-0 hover:bg-base-raised">
                  <td className="px-5 py-3 text-ink-muted">{new Date(event.occurredAt).toLocaleString()}</td>
                  <td className="px-5 py-3 text-signal-cyan">{event.eventType}</td>
                  <td className="px-5 py-3 text-ink-muted">{event.sourceIp ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{event.username ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{event.host ?? '—'}</td>
                  <td className="max-w-md truncate px-5 py-3 text-ink" title={event.rawMessage}>
                    {event.rawMessage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-sm text-ink-muted">No events match this search.</p>
        )}
      </Card>

      {data && (
        <p className="text-xs text-ink-faint">
          Showing {data.items.length} of {data.total.toLocaleString()} events
        </p>
      )}
    </div>
  );
}
