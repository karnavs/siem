import { Router } from 'express';
import * as logsController from '../controllers/logs.controller';
import { requireAuth, requireMinRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// Analysts and admins can push events (e.g. from an integration); viewers cannot.
router.post('/ingest', requireMinRole('ANALYST'), logsController.ingest);
router.get('/', logsController.list);
router.get('/summary', logsController.exportSummary);

export default router;
