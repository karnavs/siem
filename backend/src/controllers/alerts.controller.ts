import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { triageAlert } from '../services/aiTriage';
import { notifyCriticalAlert } from '../services/notification';
import { recordAudit } from '../services/auditService';
import { ApiError } from '../middleware/errorHandler';
import { SecurityEvent } from '@prisma/client';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const q = listQuerySchema.parse(req.query);

    const where = {
      organizationId: req.user.organizationId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.severity ? { severity: q.severity } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { acknowledgedBy: { select: { id: true, name: true, email: true } } },
      }),
      prisma.alert.count({ where }),
    ]);

    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const alert = await prisma.alert.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        acknowledgedBy: { select: { id: true, name: true, email: true } },
        events: { include: { event: true } },
      },
    });
    if (!alert) throw new ApiError(404, 'Alert not found');
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

    const existing = await prisma.alert.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw new ApiError(404, 'Alert not found');

    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status,
        acknowledgedById: status === 'ACKNOWLEDGED' ? req.user.sub : existing.acknowledgedById,
      },
    });

    await recordAudit({
      userId: req.user.sub,
      action: 'ALERT_STATUS_CHANGED',
      resource: `Alert:${alert.id}`,
      metadata: { from: existing.status, to: status },
      ipAddress: req.ip,
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

    const alert = await prisma.alert.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { events: { include: { event: true } } },
    });
    if (!alert) throw new ApiError(404, 'Alert not found');

    const result = await triageAlert({
      alert,
      events: alert.events.map((ae: { event: SecurityEvent }) => ae.event),
    });

    const updated = await prisma.alert.update({
      where: { id: alert.id },
      data: {
        aiSummary: result.summary,
        aiRecommendation: result.recommendation,
        aiConfidence: result.confidence,
      },
    });

    if (updated.severity === 'CRITICAL') {
      await notifyCriticalAlert(updated);
    }

    await recordAudit({
      userId: req.user.sub,
      action: 'ALERT_AI_TRIAGED',
      resource: `Alert:${alert.id}`,
      metadata: { mode: result.mode },
      ipAddress: req.ip,
    });

    return res.json({ alert: updated, aiMode: result.mode });
  } catch (err) {
    return next(err);
  }
}
