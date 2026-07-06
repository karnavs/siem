import { Request, Response, NextFunction } from 'express';
import { Severity, AlertStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { TACTIC_ORDER, TACTIC_NAMES } from '../data/mitreAttack';

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const organizationId = req.user.organizationId;

    const [totalAlerts, openAlerts, criticalOpen, totalEvents, severityBreakdown, statusBreakdown] =
      await Promise.all([
        prisma.alert.count({ where: { organizationId } }),
        prisma.alert.count({ where: { organizationId, status: 'OPEN' } }),
        prisma.alert.count({ where: { organizationId, status: 'OPEN', severity: 'CRITICAL' } }),
        prisma.securityEvent.count({ where: { organizationId } }),
        prisma.alert.groupBy({ by: ['severity'], where: { organizationId }, _count: { _all: true } }),
        prisma.alert.groupBy({ by: ['status'], where: { organizationId }, _count: { _all: true } }),
      ]);

    // Alerts per day for the last 14 days — drives the trend chart.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentAlerts = await prisma.alert.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { createdAt: true, severity: true },
    });

    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const a of recentAlerts) {
      const key = a.createdAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const alertsOverTime = [...byDay.entries()].map(([date, count]) => ({ date, count }));

    // MITRE tactic-grid heatmap data: count of alerts per tactic.
    const mitreAlerts = await prisma.alert.findMany({
      where: { organizationId, mitreTacticId: { not: null } },
      select: { mitreTacticId: true, mitreTechniqueId: true, mitreTechniqueName: true },
    });
    const tacticCounts = new Map<string, number>();
    for (const t of TACTIC_ORDER) tacticCounts.set(t, 0);
    for (const a of mitreAlerts) {
      if (a.mitreTacticId) tacticCounts.set(a.mitreTacticId, (tacticCounts.get(a.mitreTacticId) ?? 0) + 1);
    }
    const mitreHeatmap = TACTIC_ORDER.map((id) => ({
      tacticId: id,
      tacticName: TACTIC_NAMES[id],
      count: tacticCounts.get(id) ?? 0,
    }));

    return res.json({
      kpis: { totalAlerts, openAlerts, criticalOpen, totalEvents },
      severityBreakdown: severityBreakdown.map((s: { severity: Severity; _count: { _all: number } }) => ({
        severity: s.severity,
        count: s._count._all,
      })),
      statusBreakdown: statusBreakdown.map((s: { status: AlertStatus; _count: { _all: number } }) => ({
        status: s.status,
        count: s._count._all,
      })),
      alertsOverTime,
      mitreHeatmap,
    });
  } catch (err) {
    return next(err);
  }
}
