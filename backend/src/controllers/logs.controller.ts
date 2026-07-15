import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, ilike, sql } from 'drizzle-orm';
import { db } from '../db';
import { securityEvents } from '../db/schema';
import { runDetectionEngine } from '../services/detectionEngine';
import { recordAudit } from '../services/auditService';

const eventSchema = z.object({
  source:     z.string().min(1),
  eventType:  z.string().min(1),
  sourceIp:   z.string().optional(),
  username:   z.string().optional(),
  host:       z.string().optional(),
  rawMessage: z.string().min(1),
  metadata:   z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

const ingestSchema = z.union([eventSchema, z.array(eventSchema).min(1).max(500)]);

/**
 * Log ingestion endpoint. Accepts a single event or a batch, persists them,
 * then immediately runs the detection engine over the org's recent event
 * window so alerts appear without a separate cron/worker for the demo.
 * (A production deployment would decouple this onto a queue.)
 */
export async function ingest(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const parsed = ingestSchema.parse(req.body);
    const eventsInput = Array.isArray(parsed) ? parsed : [parsed];

    await db.insert(securityEvents).values(
      eventsInput.map((e) => ({
        id:             crypto.randomUUID(),
        organizationId: req.user!.organizationId,
        source:         e.source,
        eventType:      e.eventType,
        sourceIp:       e.sourceIp,
        username:       e.username,
        host:           e.host,
        rawMessage:     e.rawMessage,
        metadata:       e.metadata ?? null,
        occurredAt:     e.occurredAt ? new Date(e.occurredAt) : new Date(),
      })),
    );

    // Re-evaluate against a recent rolling window (last 24h) so correlation
    // rules (e.g. brute force counts) see context beyond just this batch.
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await db
      .select()
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.organizationId, req.user.organizationId),
          sql`${securityEvents.occurredAt} >= ${windowStart}`,
        ),
      )
      .orderBy(securityEvents.occurredAt);

    const alertsCreated = await runDetectionEngine(req.user.organizationId, recentEvents);

    return res.status(201).json({ ingested: eventsInput.length, alertsCreated });
  } catch (err) {
    return next(err);
  }
}

const listQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(25),
  eventType: z.string().optional(),
  sourceIp:  z.string().optional(),
  search:    z.string().optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const q = listQuerySchema.parse(req.query);

    const conditions = [eq(securityEvents.organizationId, req.user.organizationId)];
    if (q.eventType) conditions.push(eq(securityEvents.eventType, q.eventType));
    if (q.sourceIp)  conditions.push(eq(securityEvents.sourceIp, q.sourceIp));
    if (q.search)    conditions.push(ilike(securityEvents.rawMessage, `%${q.search}%`));

    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      db.select().from(securityEvents).where(where)
        .orderBy(sql`${securityEvents.occurredAt} desc`)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(securityEvents).where(where),
    ]);

    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
}

export async function exportSummary(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const counts = await db
      .select({
        eventType: securityEvents.eventType,
        count:     sql<number>`count(*)::int`,
      })
      .from(securityEvents)
      .where(eq(securityEvents.organizationId, req.user.organizationId))
      .groupBy(securityEvents.eventType);

    await recordAudit({
      organizationId: req.user.organizationId,
      userId:         req.user.sub,
      action:         'LOG_SUMMARY_EXPORTED',
      ipAddress:      req.ip,
    });

    return res.json({ counts: counts.map((c) => ({ eventType: c.eventType, count: c.count })) });
  } catch (err) {
    return next(err);
  }
}
