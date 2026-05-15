// ─── Core Sync Service ────────────────────────────────────────────────────────
//
// runSync() is the single entry point called by both:
//   - the cron scheduler (automatic, every 15 s)
//   - the manual API trigger (POST /api/sync)
//
// Concurrency guard: a simple boolean prevents a second run from starting
// while one is already in progress.  For multi-instance deployments this
// should be replaced with a distributed lock (e.g. Redis SETNX / Redlock).
//
// Watermark flow:
//   1. Read last_synced_at watermark from DB2.sync_watermark (per table)
//   2. Fetch DB1 rows WHERE created_at > watermark (never re-copies synced rows)
//   3. For each job: validate → insertJobWithRelations (DB2 tx) → markJobSynced (DB1)
//   4. After confirmed DB2 commit: advance watermark to MAX(job.created_at) synced
//   5. On any error: recordSyncFailure (DB1) + audit log, watermark stays put
//
// The watermark NEVER advances before DB2 commits.
// Failed jobs stay inside the watermark window and are retried next cycle.

import {
  fetchUnsyncedJobs,
  markJobSynced,
  recordSyncFailure,
} from '../repositories/db1.repository.js';

import {
  insertJobWithRelations,
  writeAuditLog,
  getWatermark,
  updateWatermark,
} from '../repositories/db2.repository.js';

import { validateJob } from '../validators/job.validator.js';
import logger from '../utils/logger.js';

let _syncRunning = false;

/**
 * Runs one complete sync cycle.
 * Returns a structured summary that is forwarded to the API caller or logged.
 */
export async function runSync() {
  if (_syncRunning) {
    logger.warn('Sync already in progress — cycle skipped');
    return { skipped: true, reason: 'A sync cycle is already running' };
  }

  _syncRunning = true;
  const cycleStart = Date.now();

  const summary = {
    skipped:      false,
    jobsFound:    0,
    jobsSynced:   0,
    jobsFailed:   0,
    jobsSkipped:  0,
    durationMs:   0,
    details:      [],
  };

  try {
    // ── Step 1: Read watermark — defines the fetch window ───────────────
    const watermark    = await getWatermark('jobs');
    let   newWatermark = watermark; // will advance as jobs succeed

    logger.info(`Sync cycle: watermark is ${watermark.toISOString()}`);

    // ── Step 2: Fetch jobs from DB1 newer than the watermark ────────────
    const jobs = await fetchUnsyncedJobs(watermark);
    summary.jobsFound = jobs.length;

    if (jobs.length === 0) {
      logger.info('Sync cycle: no new jobs since watermark — nothing to do');
      return summary;
    }

    logger.info(`Sync cycle: processing ${jobs.length} job(s)`);

    // ── Step 3: Process each job ─────────────────────────────────────────
    for (const job of jobs) {
      const jobStart = Date.now();
      const detail   = { sourceJobId: job.id, title: job.title, status: null };

      // ── 3a. Validate ──────────────────────────────────────────────────
      const check = validateJob(job);
      if (!check.valid) {
        logger.warn(`Job ${job.id} failed validation: ${check.reason}`);
        await recordSyncFailure(job.id, `Validation: ${check.reason}`);
        await writeAuditLog({ tableName: 'jobs', rowsSynced: 0, error: check.reason });
        detail.status = 'validation_failed';
        detail.error  = check.reason;
        summary.jobsSkipped++;
        summary.details.push(detail);
        continue;
      }

      // ── 3b. Insert into DB2 (atomic transaction) ──────────────────────
      try {
        const result     = await insertJobWithRelations(job);
        const durationMs = Date.now() - jobStart;

        // ── 3c. Mark synced in DB1 (safety belt) ────────────────────────
        await markJobSynced(job.id);

        // ── 3d. Advance watermark to this job's created_at if newer ─────
        //        +1ms pushes past sub-millisecond precision in DB1:
        //        pg returns microseconds but JS Date truncates to ms,
        //        so without +1 the watermark can equal created_at and
        //        the same job gets fetched again next cycle.
        const jobTs = new Date(new Date(job.created_at).getTime() + 1);
        if (jobTs > newWatermark) newWatermark = jobTs;

        // ── 3e. Write success audit rows ─────────────────────────────────
        await writeAuditLog({ tableName: 'jobs',     rowsSynced: 1,                durationMs });
        if (result.products > 0)
          await writeAuditLog({ tableName: 'products', rowsSynced: result.products, durationMs });
        if (result.blogs > 0)
          await writeAuditLog({ tableName: 'blogs',    rowsSynced: result.blogs,    durationMs });
        if (result.services > 0)
          await writeAuditLog({ tableName: 'services', rowsSynced: result.services, durationMs });

        logger.info(
          `Synced job ${job.id} → DB2 #${result.db2JobId}` +
          ` | products:${result.products} blogs:${result.blogs} services:${result.services}` +
          ` | ${durationMs}ms`,
        );

        detail.status   = 'synced';
        detail.db2JobId = result.db2JobId;
        detail.counts   = { products: result.products, blogs: result.blogs, services: result.services };
        summary.jobsSynced++;

      } catch (err) {
        const durationMs = Date.now() - jobStart;
        const errMsg     = err?.message ?? String(err);

        // P2002 = unique constraint → already in DB2 (crash recovery).
        // Advance watermark and mark DB1 done — no duplicate in DB2.
        if (err?.code === 'P2002') {
          logger.warn(`Job ${job.id} already in DB2 (P2002) — advancing watermark`);
          await markJobSynced(job.id);
          const jobTs = new Date(new Date(job.created_at).getTime() + 1);
          if (jobTs > newWatermark) newWatermark = jobTs;
          await writeAuditLog({
            tableName: 'jobs', rowsSynced: 0,
            error: 'idempotent_already_exists', durationMs,
          });
          detail.status = 'already_synced';
          summary.jobsSynced++;
        } else {
          // Real failure — DO NOT advance watermark for this job.
          // It stays inside the fetch window and will be retried next cycle.
          logger.error(`Failed to sync job ${job.id}`, { message: errMsg });
          await recordSyncFailure(job.id, errMsg);
          await writeAuditLog({
            tableName: 'jobs', rowsSynced: 0,
            error: errMsg.slice(0, 500), durationMs,
          });
          detail.status = 'failed';
          detail.error  = errMsg;
          summary.jobsFailed++;
        }
      }

      summary.details.push(detail);
    }

    // ── Step 4: Persist the new watermark if it advanced ────────────────
    if (newWatermark > watermark) {
      await updateWatermark('jobs', newWatermark);
    }

  } finally {
    _syncRunning     = false;
    summary.durationMs = Date.now() - cycleStart;
    logger.info(
      `Sync cycle complete in ${summary.durationMs}ms` +
      ` — synced:${summary.jobsSynced}` +
      ` failed:${summary.jobsFailed}` +
      ` skipped:${summary.jobsSkipped}`,
    );
  }

  return summary;
}

export function isSyncRunning() {
  return _syncRunning;
}
