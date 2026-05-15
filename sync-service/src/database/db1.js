// ─── DB1 connector ────────────────────────────────────────────────────────────
// Raw pg pool — the sync service is the ONLY external consumer of DB1.
// Access is strictly READ (fetchUnsyncedJobs) plus two targeted UPDATEs:
//   - markJobSynced()      → sets is_synced = true after DB2 success
//   - recordSyncFailure()  → increments sync_attempts on DB2 failure
// Nothing else in this codebase ever touches DB1.

import pkg from 'pg';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

const { Pool } = pkg;

let _pool = null;

export async function getDb1Pool() {
  if (_pool) return _pool;

  _pool = new Pool({
    host:                    env.db1.host,
    port:                    env.db1.port,
    database:                env.db1.database,
    user:                    env.db1.user,
    password:                env.db1.password,
    max:                     5,
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 5_000,
  });

  _pool.on('error', (err) => {
    logger.error('DB1 pool idle-client error', { message: err.message });
  });

  // Verify connection
  await _pool.query('SELECT 1');
  logger.info(`DB1 connected → ${env.db1.user}@${env.db1.host}:${env.db1.port}/${env.db1.database}`);

  // Add sync-tracking columns to DB1.jobs_selected if they don't exist yet.
  // These are the ONLY schema changes the sync service makes to DB1.
  await _applyDb1Migrations(_pool);

  return _pool;
}

async function _applyDb1Migrations(pool) {
  const migrations = [
    `ALTER TABLE jobs_selected ADD COLUMN IF NOT EXISTS is_synced       BOOLEAN   DEFAULT false`,
    `ALTER TABLE jobs_selected ADD COLUMN IF NOT EXISTS synced_at       TIMESTAMP`,
    `ALTER TABLE jobs_selected ADD COLUMN IF NOT EXISTS sync_attempts   INTEGER   DEFAULT 0`,
    `ALTER TABLE jobs_selected ADD COLUMN IF NOT EXISTS last_sync_error TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      // 42701 = column already exists — safe to ignore
      if (err.code !== '42701') throw err;
    }
  }
  logger.info('DB1 sync-tracking columns verified');
}

export async function closeDb1() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    logger.info('DB1 pool closed');
  }
}
