import { Request, Response, NextFunction } from 'express';
import { eq, and, sql, gte } from 'drizzle-orm';
import { db } from '../db';
import { alerts, securityEvents, Severity, AlertStatus } from '../db/schema';
import { TACTIC_ORDER, TACTIC_NAMES } from '../data/mitreAttack';

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const organizationId = req.user.organizationId;

    // Get count helper
    const getCount = async (whereClause: any) => {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(alerts)
        .where(whereClause);
      return result[0]?.count ?? 0;
    };

    const getEventCount = async (whereClause: any) => {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(securityEvents)
        .where(whereClause);
      return result[0]?.count ?? 0;
    };

    const [
      totalAlerts,
      openAlerts,
      criticalOpen,
      totalEvents,
      severityBreakdownRaw,
      statusBreakdownRaw,
    ] = await Promise.all([
      getCount(eq(alerts.organizationId, organizationId)),
      getCount(and(eq(alerts.organizationId, organizationId), eq(alerts.status, 'OPEN'))),
      getCount(and(eq(alerts.organizationId, organizationId), eq(alerts.status, 'OPEN'), eq(alerts.severity, 'CRITICAL'))),
      getEventCount(eq(securityEvents.organizationId, organizationId)),
      db
        .select({
          severity: alerts.severity,
          count: sql<number>`count(*)::int`,
        })
        .from(alerts)
        .where(eq(alerts.organizationId, organizationId))
        .groupBy(alerts.severity),
      db
        .select({
          status: alerts.status,
          count: sql<number>`count(*)::int`,
        })
        .from(alerts)
        .where(eq(alerts.organizationId, organizationId))
        .groupBy(alerts.status),
    ]);

    // Alerts per day for the last 14 days — drives the trend chart.
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentAlerts = await db
      .select({
        createdAt: alerts.createdAt,
        severity: alerts.severity,
      })
      .from(alerts)
      .where(and(eq(alerts.organizationId, organizationId), gte(alerts.createdAt, since)));

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
    const mitreAlerts = await db
      .select({
        mitreTacticId: alerts.mitreTacticId,
        mitreTechniqueId: alerts.mitreTechniqueId,
        mitreTechniqueName: alerts.mitreTechniqueName,
      })
      .from(alerts)
      .where(and(eq(alerts.organizationId, organizationId), sql`${alerts.mitreTacticId} IS NOT NULL`));

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
      severityBreakdown: severityBreakdownRaw.map((s) => ({
        severity: s.severity as Severity,
        count: s.count,
      })),
      statusBreakdown: statusBreakdownRaw.map((s) => ({
        status: s.status as AlertStatus,
        count: s.count,
      })),
      alertsOverTime,
      mitreHeatmap,
    });
  } catch (err) {
    return next(err);
  }
}
