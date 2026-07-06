import { Router } from 'express';
import * as alertsController from '../controllers/alerts.controller';
import { requireAuth, requireMinRole } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);

router.get('/', alertsController.list);
router.get('/:id', alertsController.getById);
// Viewers can read; only analysts+ can change alert state or trigger AI spend.
router.patch('/:id/status', requireMinRole('ANALYST'), alertsController.updateStatus);
router.post('/:id/triage', requireMinRole('ANALYST'), aiLimiter, alertsController.triage);

export default router;
