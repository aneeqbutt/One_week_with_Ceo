import { Router } from 'express';
import { getDb }   from '../db.js';

const router = Router();

// GET /api/audit?limit=50
router.get('/', async (req, res) => {
  const db    = getDb();
  const limit = Math.min(200, parseInt(req.query.limit ?? '50', 10));
  const logs  = await db.syncAuditLog.findMany({
    orderBy: { runAt: 'desc' },
    take:    limit,
  });
  res.json({ data: logs });
});

export default router;
