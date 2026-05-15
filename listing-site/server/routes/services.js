import { Router } from 'express';
import { getDb }   from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const db    = getDb();
  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [services, total] = await Promise.all([
    db.service.findMany({
      orderBy: { syncedAt: 'desc' },
      skip, take: limit,
      include: { job: { select: { id: true, title: true, niche: true } } },
    }),
    db.service.count(),
  ]);

  res.json({ data: services, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:id', async (req, res) => {
  const db     = getDb();
  const service = await db.service.findUnique({
    where:   { id: parseInt(req.params.id, 10) },
    include: { job: { select: { id: true, title: true, niche: true } } },
  });
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json({ data: service });
});

export default router;
