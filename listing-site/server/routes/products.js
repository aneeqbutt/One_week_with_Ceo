import { Router } from 'express';
import { getDb }   from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const db    = getDb();
  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit ?? '20', 10));
  const skip  = (page - 1) * limit;

  const [products, total] = await Promise.all([
    db.product.findMany({
      orderBy: { syncedAt: 'desc' },
      skip, take: limit,
      include: { job: { select: { id: true, title: true, niche: true } } },
    }),
    db.product.count(),
  ]);

  res.json({ data: products, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:id', async (req, res) => {
  const db      = getDb();
  const product = await db.product.findUnique({
    where:   { id: parseInt(req.params.id, 10) },
    include: { job: { select: { id: true, title: true, niche: true } } },
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ data: product });
});

export default router;
