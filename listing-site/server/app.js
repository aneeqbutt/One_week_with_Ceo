import 'express-async-errors';
import 'dotenv/config';
import express      from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn }         from 'child_process';
import jobRoutes     from './routes/jobs.js';
import blogRoutes    from './routes/blogs.js';
import productRoutes from './routes/products.js';
import serviceRoutes from './routes/services.js';
import auditRoutes   from './routes/audit.js';
import { getDb }     from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT      = parseInt(process.env.PORT ?? '3001', 10);

// ─── Spawn sync-service ────────────────────────────────────────────────────
// Runs as a fully separate process — loads its own .env, owns DB1 credentials.
// listing-site never sees DB1. Iron wall stays intact.
const syncServiceDir  = join(__dirname, '..', '..', 'sync-service');
const syncServiceEntry = join(syncServiceDir, 'src', 'app.js');

// Strip any DB env vars so sync-service loads its own .env cleanly.
// dotenv does not override existing variables, so we must remove them first.
const { DATABASE_URL, DB1_HOST, DB1_PORT, DB1_DATABASE, DB1_USER, DB1_PASSWORD,
        DB2_HOST, DB2_PORT, DB2_DATABASE, DB2_USER, DB2_PASSWORD, PORT: _PORT,
        ...baseEnv } = process.env;

const syncProc = spawn('node', [syncServiceEntry], {
  cwd:   syncServiceDir,
  stdio: 'inherit',
  env:   { ...baseEnv, FORCE_COLOR: '1' },
});

syncProc.on('error', (err) => {
  console.error('[sync-service] Failed to start:', err.message);
});

syncProc.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`[sync-service] Exited with code ${code}`);
  }
});

process.on('exit', () => syncProc.kill());

const app = express();
app.use(express.json());

// ─── Serve static frontend ─────────────────────────────────────────────────
app.use(express.static(join(__dirname, '..', 'public')));

// ─── API routes ────────────────────────────────────────────────────────────
app.use('/api/jobs',     jobRoutes);
app.use('/api/blogs',    blogRoutes);
app.use('/api/products', productRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/audit',    auditRoutes);

// ─── Dashboard stats ───────────────────────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
  const db = getDb();
  const [jobs, products, blogs, services, lastSync] = await Promise.all([
    db.job.count(),
    db.product.count(),
    db.blog.count(),
    db.service.count(),
    db.syncAuditLog.findFirst({ orderBy: { runAt: 'desc' } }),
  ]);
  res.json({ data: { jobs, products, blogs, services, lastSync } });
});

// ─── SPA fallback ──────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

// ─── Error handler ─────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Listing site → http://localhost:${PORT}`);
  console.log('  Reads DB2 (listing_site) only — zero DB1 knowledge');
});
