import { Router } from 'express';
import { getDb }   from '../db.js';

const router = Router();

// GET /api/jobs?page=1&limit=20&niche=saas&platform=github&tool=react
router.get('/', async (req, res) => {
  const db    = getDb();
  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const where = {};
  if (req.query.niche)    where.niche    = req.query.niche;
  if (req.query.platform) where.platform = req.query.platform;
  if (req.query.tool)     where.tool     = req.query.tool;

  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: { syncedAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: { select: { products: true, blogs: true, services: true } },
      },
    }),
    db.job.count({ where }),
  ]);

  res.json({ data: jobs, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// GET /api/jobs/:id  — full detail with all relations
router.get('/:id', async (req, res) => {
  const db  = getDb();
  const id  = parseInt(req.params.id, 10);
  const job = await db.job.findUnique({
    where:   { id },
    include: { products: true, blogs: true, services: true },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ data: job });
});

export default router;
