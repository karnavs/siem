import { Router } from 'express';
import { requireAuth, requireMinRole } from '../middleware/auth';
import { db } from '../db';
import { auditLogs, users } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// Audit trail is sensitive (shows who-did-what) — admin only.
router.get('/', requireMinRole('ADMIN'), async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const q = querySchema.parse(req.query);
    const orgId = req.user.organizationId;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          organizationId: auditLogs.organizationId,
          userId: auditLogs.userId,
          action: auditLogs.action,
          resource: auditLogs.resource,
          ipAddress: auditLogs.ipAddress,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.organizationId, orgId))
        .orderBy(sql`${auditLogs.createdAt} desc`)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgId)),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      action: row.action,
      resource: row.resource,
      ipAddress: row.ipAddress,
      metadata: row.metadata,
      createdAt: row.createdAt,
      user: row.user?.id ? row.user : null,
    }));

    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    next(err);
  }
});

export default router;
