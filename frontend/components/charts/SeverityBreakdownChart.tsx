'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Severity } from '@/lib/types';

interface Props {
  data: { severity: Severity; count: number }[];
}

const COLORS: Record<Severity, string> = {
  CRITICAL: '#EF4444',
  HIGH: '#F5A623',
  MEDIUM: '#EAB308',
  LOW: '#3FA9F5',
};

export function SeverityBreakdownChart({ data }: Props) {
  const filtered = data.filter((d) => d.count > 0);

  if (filtered.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-ink-muted">No alert data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="count"
          nameKey="severity"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          strokeWidth={0}
        >
          {filtered.map((entry) => (
            <Cell key={entry.severity} fill={COLORS[entry.severity]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#131826',
            border: '1px solid #232B3D',
            borderRadius: 8,
            fontSize: 12,
            color: '#E8EAED',
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-xs text-ink-muted">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
