import EventEmitter from 'events';

class SyncNotifier extends EventEmitter {
  constructor() {
    super();
    this.intervalId     = null;
    this.lastSeenId     = null;
    this.pollIntervalMs = 30 * 1000;
    this.apiUrl         = 'http://localhost:4000/api/sync/logs?limit=10';
  }

  async poll() {
    try {
      const res = await fetch(this.apiUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;

      const rows = (await res.json())?.data;
      if (!Array.isArray(rows)) return;

      // First poll: set baseline to highest ID in DB (0 if empty)
      if (this.lastSeenId === null) {
        this.lastSeenId = rows.length > 0 ? rows[0].id : 0;
        console.log(`[SyncNotifier] baseline set → lastSeenId=${this.lastSeenId}`);
        return;
      }

      // Find successful rows newer than baseline
      const fresh = rows.filter(r =>
        r.id > this.lastSeenId &&
        r.error === null &&
        r.rowsSynced > 0
      );

      // Advance baseline
      const maxId = rows.reduce((max, r) => Math.max(max, r.id), this.lastSeenId);
      this.lastSeenId = maxId;

      if (fresh.length === 0) return;

      const totalSynced = fresh.reduce((sum, r) => sum + r.rowsSynced, 0);
      console.log(`[SyncNotifier] 🔔 FIRING notification — ${totalSynced} rows synced`);
      this.emit('sync-update', { recordsSynced: totalSynced, syncedAt: fresh[0].runAt });

    } catch {
      // sync service not running — silent, retries automatically every 30s
    }
  }

  start() {
    console.log('[SyncNotifier] started — polling sync service every 30s');
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const syncNotifier = new SyncNotifier();
