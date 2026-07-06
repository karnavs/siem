'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Alert, AlertStatus } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { SeverityBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [alert, setAlert] = useState<Alert | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [aiMode, setAiMode] = useState<'live' | 'mock' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ alert: Alert }>(`/api/alerts/${id}`)
      .then(({ alert }) => setAlert(alert))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load alert'));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runTriage() {
    setTriaging(true);
    setError(null);
    try {
      const result = await apiFetch<{ alert: Alert; aiMode: 'live' | 'mock' }>(`/api/alerts/${id}/triage`, {
        method: 'POST',
      });
      setAlert(result.alert);
      setAiMode(result.aiMode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'AI triage failed');
    } finally {
      setTriaging(false);
    }
  }

  async function setStatus(status: AlertStatus) {
    setUpdating(true);
    try {
      const result = await apiFetch<{ alert: Alert }>(`/api/alerts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setAlert(result.alert);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  if (error && !alert) return <p className="text-sm text-severity-critical">{error}</p>;
  if (!alert) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const canAct = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  return (
    <div className="max-w-4xl space-y-6">
      <button
        onClick={() => router.push('/dashboard/alerts')}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to alerts
      </button>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-ink">{alert.title}</h1>
          <SeverityBadge severity={alert.severity} />
          <StatusBadge status={alert.status} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{alert.description}</p>
      </div>

      {error && (
        <p className="rounded-lg border border-severity-critical/30 bg-severity-critical/10 px-3 py-2 text-sm text-severity-critical">
          {error}
        </p>
      )}

      <Card>
        <CardHeader title="MITRE ATT&CK mapping" />
        <div className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
          <Field label="Tactic" value={`${alert.mitreTacticId ?? '—'}`} />
          <Field label="Tactic name" value={alert.mitreTacticName ?? '—'} />
          <Field label="Technique" value={alert.mitreTechniqueId ?? '—'} />
          <Field label="Technique name" value={alert.mitreTechniqueName ?? '—'} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="AI triage"
          subtitle={aiMode === 'mock' ? 'Mock mode — no OPENAI_API_KEY configured' : undefined}
          action={
            canAct && (
              <Button onClick={runTriage} disabled={triaging} variant="secondary">
                <Sparkles className="h-4 w-4" />
                {triaging ? 'Analyzing…' : alert.aiSummary ? 'Re-run triage' : 'Run AI triage'}
              </Button>
            )
          }
        />
        <div className="space-y-4 p-5">
          {alert.aiSummary ? (
            <>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Summary</p>
                <p className="text-sm leading-relaxed text-ink">{alert.aiSummary}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Recommended action</p>
                <p className="text-sm leading-relaxed text-ink">{alert.aiRecommendation}</p>
              </div>
              {alert.aiConfidence !== null && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-base-raised">
                      <div
                        className="h-full bg-signal-amber"
                        style={{ width: `${Math.round((alert.aiConfidence ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-ink-muted">
                      {Math.round((alert.aiConfidence ?? 0) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              No AI analysis yet.{' '}
              {canAct ? 'Run triage to get a summary and recommended next step.' : 'Ask an analyst to run triage.'}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Underlying events" subtitle={`${alert.events?.length ?? 0} event(s) correlated into this alert`} />
        <div className="max-h-80 overflow-y-auto">
          {alert.events?.map(({ event }) => (
            <div key={event.id} className="border-b border-base-border px-5 py-3 last:border-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-muted">
                <span>{new Date(event.occurredAt).toLocaleString()}</span>
                <span className="text-signal-cyan">{event.eventType}</span>
                {event.sourceIp && <span>ip={event.sourceIp}</span>}
                {event.username && <span>user={event.username}</span>}
                {event.host && <span>host={event.host}</span>}
              </div>
              <p className="mt-1 text-sm text-ink">{event.rawMessage}</p>
            </div>
          ))}
        </div>
      </Card>

      {canAct && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setStatus('ACKNOWLEDGED')} disabled={updating} variant="secondary">
            Acknowledge
          </Button>
          <Button onClick={() => setStatus('RESOLVED')} disabled={updating} variant="secondary">
            <CheckCircle2 className="h-4 w-4" /> Mark resolved
          </Button>
          <Button onClick={() => setStatus('FALSE_POSITIVE')} disabled={updating} variant="danger">
            <XCircle className="h-4 w-4" /> False positive
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-ink">{value}</p>
    </div>
  );
}
