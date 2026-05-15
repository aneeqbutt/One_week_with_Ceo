import { runSync, isSyncRunning } from '../services/sync.service.js';
import { getRecentAuditLogs }     from '../repositories/db2.repository.js';
import logger                      from '../utils/logger.js';

/**
 * POST /api/sync
 * Manual trigger. Runs a full sync cycle and returns the structured result.
 * Returns 202 if a cycle was already running (skipped).
 */
export async function triggerSync(req, res) {
  logger.info('Manual sync triggered via API');
  const result = await runSync();
  const status = result.skipped ? 202 : 200;
  return res.status(status).json({ success: true, data: result });
}

/**
 * GET /api/sync/status
 * Returns whether a sync is currently in progress.
 */
export async function getSyncStatus(req, res) {
  return res.json({ success: true, data: { running: isSyncRunning() } });
}

/**
 * GET /api/sync/logs?limit=20
 * Returns recent sync_audit_log rows from DB2.
 */
export async function getAuditLogs(req, res) {
  const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
  const logs  = await getRecentAuditLogs(limit);
  return res.json({ success: true, data: logs });
}
