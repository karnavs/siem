import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { alerts, alertEvents, securityEvents, users, AlertStatus, Severity } from '../db/schema';
import { triageAlert } from '../services/aiTriage';
import { notifyCriticalAlert } from '../services/notification';
import { recordAudit } from '../services/auditService';
import { ApiError } from '../middleware/errorHandler';

const listQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(25),
  status:    z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE']).optional(),
  severity:  z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const q = listQuerySchema.parse(req.query);

    const conditions = [eq(alerts.organizationId, req.user.organizationId)];
    if (q.status)   conditions.push(eq(alerts.status, q.status));
    if (q.severity) conditions.push(eq(alerts.severity, q.severity));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          alert:          alerts,
          acknowledgedBy: {
            id:    users.id,
            name:  users.name,
            email: users.email,
          },
        })
        .from(alerts)
        .leftJoin(users, eq(alerts.acknowledgedById, users.id))
        .where(where)
        .orderBy(sql`${alerts.createdAt} desc`)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(alerts).where(where),
    ]);

    const items = rows.map(({ alert, acknowledgedBy }) => ({
      ...alert,
      acknowledgedBy: acknowledgedBy?.id ? acknowledgedBy : null,
    }));

    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const [row] = await db
      .select({
        alert:          alerts,
        acknowledgedBy: {
          id:    users.id,
          name:  users.name,
          email: users.email,
        },
      })
      .from(alerts)
      .leftJoin(users, eq(alerts.acknowledgedById, users.id))
      .where(and(eq(alerts.id, req.params.id), eq(alerts.organizationId, req.user.organizationId)))
      .limit(1);

    if (!row) throw new ApiError(404, 'Alert not found');

    const eventRows = await db
      .select({ event: securityEvents })
      .from(alertEvents)
      .innerJoin(securityEvents, eq(alertEvents.eventId, securityEvents.id))
      .where(eq(alertEvents.alertId, req.params.id));

    const alert = {
      ...row.alert,
      acknowledgedBy: row.acknowledgedBy?.id ? row.acknowledgedBy : null,
      events: eventRows.map(({ event }) => ({ event })),
    };

    return res.json({ alert });
  } catch (err) {
    return next(err);
  }
}

const statusSchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE']),
});

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { status } = statusSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.id, req.params.id), eq(alerts.organizationId, req.user.organizationId)))
      .limit(1);

    if (!existing) throw new ApiError(404, 'Alert not found');

    const [alert] = await db
      .update(alerts)
      .set({
        status,
        acknowledgedById: status === 'ACKNOWLEDGED' ? req.user.sub : existing.acknowledgedById,
        updatedAt:        new Date(),
      })
      .where(eq(alerts.id, req.params.id))
      .returning();

    await recordAudit({
      organizationId: req.user.organizationId,
      userId:         req.user.sub,
      action:         'ALERT_STATUS_CHANGED',
      resource:       `Alert:${alert.id}`,
      metadata:       { from: existing.status, to: status },
      ipAddress:      req.ip,
    });

    return res.json({ alert });
  } catch (err) {
    return next(err);
  }
}

/**
 * Runs AI triage on an alert (live OpenAI call if configured, deterministic
 * mock otherwise) and persists the result onto the alert record.
 */
export async function triage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const [alertRow] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.id, req.params.id), eq(alerts.organizationId, req.user.organizationId)))
      .limit(1);

    if (!alertRow) throw new ApiError(404, 'Alert not found');

    const eventRows = await db
      .select({ event: securityEvents })
      .from(alertEvents)
      .innerJoin(securityEvents, eq(alertEvents.eventId, securityEvents.id))
      .where(eq(alertEvents.alertId, req.params.id));

    const result = await triageAlert({
      alert:  alertRow,
      events: eventRows.map(({ event }) => event),
    });

    const [updated] = await db
      .update(alerts)
      .set({
        aiSummary:        result.summary,
        aiRecommendation: result.recommendation,
        aiConfidence:     result.confidence,
        updatedAt:        new Date(),
      })
      .where(eq(alerts.id, alertRow.id))
      .returning();

    if (updated.severity === 'CRITICAL') {
      await notifyCriticalAlert(updated);
    }

    await recordAudit({
      organizationId: req.user.organizationId,
      userId:         req.user.sub,
      action:         'ALERT_AI_TRIAGED',
      resource:       `Alert:${alertRow.id}`,
      metadata:       { mode: result.mode },
      ipAddress:      req.ip,
    });

    return res.json({ alert: updated, aiMode: result.mode });
  } catch (err) {
    return next(err);
  }
}
