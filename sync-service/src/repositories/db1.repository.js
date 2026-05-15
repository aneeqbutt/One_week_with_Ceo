// ─── DB1 Repository — READ + sync-flag writes ONLY ───────────────────────────
//
// This module is the single point of contact between the sync service and DB1.
// No other module queries DB1 directly.
//
// Query strategy:
//   fetchUnsyncedJobs() issues ONE query for jobs, then ONE query PER relation
//   table (products, blogs, services) using an IN clause over the batch of job
//   IDs.  That is 4 queries total regardless of batch size — no N+1 problem.

import { getDb1Pool } from '../database/db1.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Returns jobs that need syncing, based on a watermark timestamp.
 *
 * Fetch strategy:
 *   - Only rows with created_at > watermark are considered (watermark filter).
 *   - Within that window, jobs with sync_attempts >= maxAttempts are excluded
 *     (dead-letter behaviour — they failed too many times).
 *   - Results are ordered oldest-first so the watermark always advances in
 *     a consistent direction.
 *
 * @param {Date} since  - The current high-water mark from DB2.sync_watermark.
 *                        Defaults to epoch (fetches everything on first run).
 */
export async function fetchUnsyncedJobs(since = new Date(0)) {
  const pool = await getDb1Pool();
  const { batchSize, maxAttempts } = env.sync;

  // ── 1. Fetch job batch ───────────────────────────────────────────────────
  const jobsRes = await pool.query(
    `SELECT
       id, campaign_id, title, description, niche, platform, tool,
       upwork_url, search_query, created_at, sync_attempts
     FROM jobs_selected
     WHERE created_at > $1
       AND sync_attempts < $2
     ORDER BY created_at ASC
     LIMIT $3`,
    [since, maxAttempts, batchSize],
  );

  const jobs = jobsRes.rows;
  if (jobs.length === 0) return [];

  // ── 2. Batch-fetch all relations in 3 parallel queries ───────────────────
  const ids         = jobs.map((j) => j.id);
  const placeholder = ids.map((_, i) => `$${i + 1}`).join(', ');

  const [productsRes, blogsRes, servicesRes] = await Promise.all([
    pool.query(
      `SELECT id, job_id, repo_name, description, readme, topics, created_at
       FROM product WHERE job_id IN (${placeholder})`,
      ids,
    ),
    pool.query(
      `SELECT id, job_id, title, content, created_at
       FROM blog WHERE job_id IN (${placeholder})`,
      ids,
    ),
    pool.query(
      `SELECT id, job_id, title, content, created_at
       FROM services WHERE job_id IN (${placeholder})`,
      ids,
    ),
  ]);

  // ── 3. Group relations by job_id ─────────────────────────────────────────
  const byJob = (rows, key = 'job_id') =>
    rows.reduce((acc, row) => {
      (acc[row[key]] ??= []).push(row);
      return acc;
    }, {});

  const productMap  = byJob(productsRes.rows);
  const blogMap     = byJob(blogsRes.rows);
  const serviceMap  = byJob(servicesRes.rows);

  return jobs.map((job) => ({
    ...job,
    products: productMap[job.id]  ?? [],
    blogs:    blogMap[job.id]     ?? [],
    services: serviceMap[job.id]  ?? [],
  }));
}

/**
 * Marks a DB1 job as successfully synced.
 * Called ONLY after the DB2 transaction has committed without error.
 */
export async function markJobSynced(jobId) {
  const pool = await getDb1Pool();
  await pool.query(
    `UPDATE jobs_selected
     SET is_synced = true, synced_at = NOW(), last_sync_error = NULL
     WHERE id = $1`,
    [jobId],
  );
}

/**
 * Records a sync failure on a DB1 job.
 * Increments sync_attempts so the job is retried on the next cycle.
 * If sync_attempts reaches SYNC_MAX_ATTEMPTS the job is excluded from future
 * fetches — dead-letter behaviour without a separate queue.
 */
export async function recordSyncFailure(jobId, errorMessage) {
  const pool = await getDb1Pool();
  await pool.query(
    `UPDATE jobs_selected
     SET sync_attempts   = sync_attempts + 1,
         last_sync_error = $1
     WHERE id = $2`,
    [String(errorMessage).slice(0, 1000), jobId],
  );
  logger.warn(`DB1 failure recorded for job ${jobId}`, { error: String(errorMessage).slice(0, 200) });
}
