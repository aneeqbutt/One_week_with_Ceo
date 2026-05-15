// ─── Sync Service — Entry Point ───────────────────────────────────────────────
//
//  IRON WALL architecture:
//    DB1 (upwork_jobs)  ──[pg read + 2 UPDATEs]──►  THIS SERVICE  ──[Prisma writes]──►  DB2 (listing_site)
//
//  DB1 and DB2 never communicate directly.
//  The listing website has its own separate process and Prisma client pointing
//  at DB2 — it has zero knowledge of DB1.

import 'express-async-errors'; // patches express to forward async errors to errorHandler
import 'dotenv/config';
import express    from 'express';
import { env }    from './config/env.js';
import { getDb1Pool, closeDb1 } from './database/db1.js';
import { connectDb2, closeDb2 } from './database/db2.js';
import { startCron, stopCron }  from './cron/syncCron.js';
import syncRoutes from './routes/sync.routes.js';
import { requestLogger }                   from './middleware/requestLogger.middleware.js';
import { notFound, errorHandler }          from './middleware/error.middleware.js';
import logger from './utils/logger.js';

const app = express();
app.use(express.json());
app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() }),
);
app.use('/api/sync', syncRoutes);

// ─── 404 + global error ───────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  logger.info('═'.repeat(56));
  logger.info('  SYNC SERVICE  starting');
  logger.info(`  Port     : ${env.port}`);
  logger.info(`  Interval : ${env.sync.intervalMs} ms`);
  logger.info(`  Batch    : ${env.sync.batchSize} jobs / cycle`);
  logger.info(`  Retries  : ${env.sync.maxAttempts} max attempts`);
  logger.info('═'.repeat(56));

  await getDb1Pool();   // connect + migrate sync columns
  await connectDb2();   // connect Prisma

  startCron();          // fire immediately, then every SYNC_INTERVAL_MS

  const server = app.listen(env.port, () => {
    logger.info(`HTTP listening → http://localhost:${env.port}`);
    logger.info('  POST /api/sync        — manual trigger');
    logger.info('  GET  /api/sync/status — running?');
    logger.info('  GET  /api/sync/logs   — audit log');
    logger.info('  GET  /health          — health check');
  });

  // ─── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down`);
    stopCron();
    server.close(async () => {
      await Promise.allSettled([closeDb1(), closeDb2()]);
      logger.info('Sync service shut down cleanly');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced exit after 10 s timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
});
