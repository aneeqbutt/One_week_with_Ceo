// ─── Cron Scheduler ───────────────────────────────────────────────────────────
//
// Uses setInterval (not node-cron) because the required interval is 15 seconds,
// which is below the 1-minute resolution of cron expressions.
//
// The interval fires from the moment the previous call was SCHEDULED, not when
// it finished.  The concurrency guard inside runSync() ensures that if a cycle
// takes longer than 15 s the next tick is skipped rather than stacked.
//
// timer.unref() prevents the timer from keeping the Node.js event loop alive
// after the HTTP server has closed — clean shutdown works correctly.

import { runSync } from '../services/sync.service.js';
import { env }     from '../config/env.js';
import logger      from '../utils/logger.js';

let _timer = null;

export function startCron() {
  if (_timer) {
    logger.warn('Cron already running — startCron() called twice');
    return;
  }

  logger.info(
    `Sync cron started | interval: ${env.sync.intervalMs}ms` +
    ` | batch: ${env.sync.batchSize} | max-attempts: ${env.sync.maxAttempts}`,
  );

  // Fire immediately on startup so the first sync does not wait 15 s
  _runCycle();

  _timer = setInterval(_runCycle, env.sync.intervalMs);
  _timer.unref();
}

export function stopCron() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    logger.info('Sync cron stopped');
  }
}

function _runCycle() {
  runSync().catch((err) => {
    logger.error('Unhandled error in sync cycle', { message: err.message, stack: err.stack });
  });
}
