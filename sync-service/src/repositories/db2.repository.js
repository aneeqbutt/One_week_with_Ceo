// ─── DB2 Repository — WRITE ONLY ─────────────────────────────────────────────
//
// All writes to DB2 go through this module.
// insertJobWithRelations() wraps everything in a Prisma interactive transaction:
//   - Either ALL records (job + products + blogs + services) commit together,
//     or none do.
//   - The caller marks DB1 as synced ONLY after this function resolves without
//     throwing. If it throws, DB1 is left untouched.
//
// Idempotency: source_id is UNIQUE on every DB2 table.
//   - A re-sync of an already-present job will throw Prisma error P2002.
//   - The sync service catches P2002 and treats it as "already done."

import { getDb2Client } from '../database/db2.js';
import logger from '../utils/logger.js';

// Default watermark for the very first run — fetches everything from DB1
const EPOCH = new Date(0);

/**
 * Atomically inserts one job and all its relational records into DB2.
 * Returns a summary of what was inserted.
 */
export async function insertJobWithRelations(jobRecord) {
  const prisma = getDb2Client();

  return prisma.$transaction(async (tx) => {
    // ── Insert the job ───────────────────────────────────────────────────
    const job = await tx.job.create({
      data: {
        sourceId:    jobRecord.id,
        campaignId:  jobRecord.campaign_id ?? '',
        title:       jobRecord.title,
        description: jobRecord.description  ?? null,
        niche:       jobRecord.niche         ?? null,
        platform:    jobRecord.platform      ?? null,
        tool:        jobRecord.tool          ?? null,
        upworkUrl:   jobRecord.upwork_url    ?? null,
        searchQuery: jobRecord.search_query  ?? null,
        createdAt:   jobRecord.created_at    ?? new Date(),
      },
    });

    // ── Insert products (batch) ──────────────────────────────────────────
    if (jobRecord.products?.length) {
      await tx.product.createMany({
        data: jobRecord.products.map((p) => ({
          jobId:       job.id,
          sourceId:    p.id,
          repoName:    p.repo_name    ?? null,
          description: p.description  ?? null,
          readme:      p.readme       ?? null,
          topics:      p.topics       ?? [],
          createdAt:   p.created_at   ?? new Date(),
        })),
        skipDuplicates: true,
      });
    }

    // ── Insert blogs (batch) ─────────────────────────────────────────────
    if (jobRecord.blogs?.length) {
      await tx.blog.createMany({
        data: jobRecord.blogs.map((b) => ({
          jobId:     job.id,
          sourceId:  b.id,
          title:     b.title    ?? null,
          content:   b.content  ?? null,
          createdAt: b.created_at ?? new Date(),
        })),
        skipDuplicates: true,
      });
    }

    // ── Insert services (batch) ──────────────────────────────────────────
    if (jobRecord.services?.length) {
      await tx.service.createMany({
        data: jobRecord.services.map((s) => ({
          jobId:     job.id,
          sourceId:  s.id,
          title:     s.title    ?? null,
          content:   s.content  ?? null,
          createdAt: s.created_at ?? new Date(),
        })),
        skipDuplicates: true,
      });
    }

    return {
      db2JobId:  job.id,
      products:  jobRecord.products?.length  ?? 0,
      blogs:     jobRecord.blogs?.length     ?? 0,
      services:  jobRecord.services?.length  ?? 0,
    };
  });
}

/**
 * Writes a single audit log row to DB2.sync_audit_log.
 * error = null  → success row
 * error = TEXT  → failure row
 * Failures here must never crash the sync cycle.
 */
export async function writeAuditLog({ tableName, rowsSynced, error = null, durationMs = null }) {
  const prisma = getDb2Client();
  try {
    await prisma.syncAuditLog.create({
      data: { tableName, rowsSynced, error, durationMs },
    });
  } catch (err) {
    logger.error('Failed to write audit log — non-fatal', { message: err.message, tableName });
  }
}

/**
 * Returns recent audit log rows — used by the /api/sync/logs endpoint.
 */
export async function getRecentAuditLogs(limit = 20) {
  const prisma = getDb2Client();
  return prisma.syncAuditLog.findMany({
    orderBy: { runAt: 'desc' },
    take:    limit,
  });
}

// ─── Watermark ────────────────────────────────────────────────────────────────

/**
 * Returns the high-water mark for a given table.
 * If no watermark row exists yet (first run) returns epoch (1970-01-01)
 * so the first fetch pulls every row from DB1.
 */
export async function getWatermark(tableName) {
  const prisma = getDb2Client();
  const row = await prisma.syncWatermark.findUnique({ where: { tableName } });
  return row?.lastSyncedAt ?? EPOCH;
}

/**
 * Advances the watermark for a given table to `timestamp`.
 * Uses upsert so it works on the first run (no existing row) and on every
 * subsequent run (updates the existing row).
 * Called ONLY after the DB2 transaction commits — never on failure.
 */
export async function updateWatermark(tableName, timestamp) {
  const prisma = getDb2Client();
  await prisma.syncWatermark.upsert({
    where:  { tableName },
    update: { lastSyncedAt: timestamp },
    create: { tableName,   lastSyncedAt: timestamp },
  });
  logger.info(`Watermark advanced | table:${tableName} → ${timestamp.toISOString()}`);
}
