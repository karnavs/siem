import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { runDetectionEngine } from '../services/detectionEngine';
import { recordAudit } from '../services/auditService';

const eventSchema = z.object({
  source: z.string().min(1),
  eventType: z.string().min(1),
  sourceIp: z.string().optional(),
  username: z.string().optional(),
  host: z.string().optional(),
  rawMessage: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
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
    const events = Array.isArray(parsed) ? parsed : [parsed];

    const created = await prisma.$transaction(
      events.map((e) =>
        prisma.securityEvent.create({
          data: {
            organizationId: req.user!.organizationId,
            source: e.source,
            eventType: e.eventType,
            sourceIp: e.sourceIp,
            username: e.username,
            host: e.host,
            rawMessage: e.rawMessage,
            metadata: e.metadata as never,
            occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
          },
        }),
      ),
    );

    // Re-evaluate against a recent rolling window (last 24h) so correlation
    // rules (e.g. brute force counts) see context beyond just this batch.
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await prisma.securityEvent.findMany({
      where: { organizationId: req.user.organizationId, occurredAt: { gte: windowStart } },
      orderBy: { occurredAt: 'asc' },
    });

    const alertsCreated = await runDetectionEngine(req.user.organizationId, recentEvents);

    return res.status(201).json({ ingested: created.length, alertsCreated });
  } catch (err) {
    return next(err);
  }
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  eventType: z.string().optional(),
  sourceIp: z.string().optional(),
  search: z.string().optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const q = listQuerySchema.parse(req.query);

    const where = {
      organizationId: req.user.organizationId,
      ...(q.eventType ? { eventType: q.eventType } : {}),
      ...(q.sourceIp ? { sourceIp: q.sourceIp } : {}),
      ...(q.search
        ? { rawMessage: { contains: q.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.securityEvent.count({ where }),
    ]);

    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
}

export async function exportSummary(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const counts = await prisma.securityEvent.groupBy({
      by: ['eventType'],
      where: { organizationId: req.user.organizationId },
      _count: { _all: true },
    });

    await recordAudit({ userId: req.user.sub, action: 'LOG_SUMMARY_EXPORTED', ipAddress: req.ip });

    return res.json({ counts: counts.map((c: { eventType: string; _count: { _all: number } }) => ({ eventType: c.eventType, count: c._count._all })) });
  } catch (err) {
    return next(err);
  }
}
