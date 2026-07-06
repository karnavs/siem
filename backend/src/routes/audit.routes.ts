import { Router } from 'express';
import { requireAuth, requireMinRole } from '../middleware/auth';
import { prisma } from '../config/prisma';
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
    const q = querySchema.parse(req.query);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    next(err);
  }
});

export default router;
