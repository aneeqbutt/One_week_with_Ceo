import { Router } from 'express';
import { getDb }   from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const db    = getDb();
  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [blogs, total] = await Promise.all([
    db.blog.findMany({
      orderBy: { syncedAt: 'desc' },
      skip, take: limit,
      include: { job: { select: { id: true, title: true, niche: true } } },
    }),
    db.blog.count(),
  ]);

  res.json({ data: blogs, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:id', async (req, res) => {
  const db   = getDb();
  const blog = await db.blog.findUnique({
    where:   { id: parseInt(req.params.id, 10) },
    include: { job: { select: { id: true, title: true, niche: true, platform: true } } },
  });
  if (!blog) return res.status(404).json({ error: 'Blog not found' });
  res.json({ data: blog });
});

export default router;
