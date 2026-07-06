'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  data: { date: string; count: number }[];
}

export function AlertsOverTimeChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="alertsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#F5A623" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#232B3D" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#8B93A7', fontSize: 11 }}
          axisLine={{ stroke: '#232B3D' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fill: '#8B93A7', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: '#131826',
            border: '1px solid #232B3D',
            borderRadius: 8,
            fontSize: 12,
            color: '#E8EAED',
          }}
          labelStyle={{ color: '#8B93A7' }}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Alerts"
          stroke="#F5A623"
          strokeWidth={2}
          fill="url(#alertsFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
