import { Router }                                    from 'express';
import { triggerSync, getSyncStatus, getAuditLogs } from '../controllers/sync.controller.js';

const router = Router();

router.post('/',       triggerSync);    // POST /api/sync
router.get('/status',  getSyncStatus);  // GET  /api/sync/status
router.get('/logs',    getAuditLogs);   // GET  /api/sync/logs?limit=N

export default router;
