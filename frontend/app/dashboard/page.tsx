'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, Flame, Database } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { DashboardOverview } from '@/lib/types';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { AlertsOverTimeChart } from '@/components/charts/AlertsOverTimeChart';
import { SeverityBreakdownChart } from '@/components/charts/SeverityBreakdownChart';
import { MitreTacticGrid } from '@/components/charts/MitreTacticGrid';

export default function OverviewPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardOverview>('/api/dashboard/overview')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <p className="text-sm text-severity-critical">Failed to load dashboard: {error}</p>;
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Threat Overview</h1>
        <p className="mt-1 text-sm text-ink-muted">Last 14 days of correlated activity across your environment.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open alerts" value={data.kpis.openAlerts} icon={<ShieldAlert className="h-5 w-5" />} tone="amber" />
        <StatCard
          label="Critical (open)"
          value={data.kpis.criticalOpen}
          icon={<Flame className="h-5 w-5" />}
          tone={data.kpis.criticalOpen > 0 ? 'critical' : 'default'}
        />
        <StatCard label="Total alerts" value={data.kpis.totalAlerts} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Events ingested" value={data.kpis.totalEvents.toLocaleString()} icon={<Database className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader title="MITRE ATT&CK coverage" subtitle="Alert volume mapped across the kill chain" />
        <div className="p-5">
          <MitreTacticGrid data={data.mitreHeatmap} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Alerts over time" subtitle="Daily alert volume, last 14 days" />
          <div className="p-5">
            <AlertsOverTimeChart data={data.alertsOverTime} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Severity mix" />
          <div className="p-5">
            <SeverityBreakdownChart data={data.severityBreakdown} />
          </div>
        </Card>
      </div>
    </div>
  );
}
