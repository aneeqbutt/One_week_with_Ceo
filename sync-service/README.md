# Sync Service

Standalone microservice that bridges **DB1** (`upwork_jobs`) and **DB2** (`listing_site`).

```
DB1 (upwork_jobs)
  └─[pg read + 2 UPDATEs]─► Sync Service ─[Prisma writes]─► DB2 (listing_site)
                                                                  └─► Listing Website
```

DB1 and DB2 never communicate directly. The listing website has zero knowledge of DB1.

---

## Architecture

| Layer | File | Responsibility |
|---|---|---|
| Config | `src/config/env.js` | Validated env variables |
| DB connectors | `src/database/db1.js` + `db2.js` | pg Pool (DB1) + Prisma (DB2) |
| Repositories | `src/repositories/` | All queries isolated per DB |
| Validator | `src/validators/job.validator.js` | Validate before insert |
| Sync service | `src/services/sync.service.js` | Core pipeline logic |
| Cron | `src/cron/syncCron.js` | setInterval every 15 s |
| Controller | `src/controllers/sync.controller.js` | HTTP handlers |
| Routes | `src/routes/sync.routes.js` | Express router |
| Middleware | `src/middleware/` | Error handler + request logger |
| Logger | `src/utils/logger.js` | Winston + daily rotate |

---

## Setup

### 1. Prerequisites
- Node.js 18+
- PostgreSQL running locally
- `upwork_jobs` database must exist and be populated

### 2. Create DB2
```sql
CREATE DATABASE listing_site;
```

### 3. Install dependencies
```bash
cd sync-service
npm install
```

### 4. Configure environment
```bash
# .env is already pre-filled — edit if your credentials differ
# DB1_PASSWORD and DB2_PASSWORD must match your PostgreSQL password
```

### 5. Push DB2 schema
```bash
npm run db:generate   # generate Prisma client
npm run db:push       # create all tables in listing_site
```

### 6. Start
```bash
npm start             # production
npm run dev           # development (auto-restart)
```

---

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/sync` | Trigger a manual sync cycle |
| `GET` | `/api/sync/status` | Is a sync currently running? |
| `GET` | `/api/sync/logs?limit=20` | Recent audit log entries |
| `GET` | `/health` | Health check |

### POST /api/sync — example response
```json
{
  "success": true,
  "data": {
    "skipped": false,
    "jobsFound": 3,
    "jobsSynced": 3,
    "jobsFailed": 0,
    "jobsSkipped": 0,
    "durationMs": 412,
    "details": [
      { "sourceJobId": 7, "title": "Build SaaS dashboard", "status": "synced", "db2JobId": 1, "counts": { "products": 1, "blogs": 1, "services": 1 } }
    ]
  }
}
```

---

## Sync Flow

```
1. setInterval fires every 15 s (or POST /api/sync)
2. fetchUnsyncedJobs()        → DB1: SELECT * FROM jobs_selected WHERE is_synced = false
3. For each job:
   a. validateJob()           → reject if missing required fields
   b. insertJobWithRelations() → Prisma $transaction (jobs + products + blogs + services)
   c. markJobSynced()         → DB1: UPDATE is_synced = true  ← ONLY after DB2 commit
   d. writeAuditLog()         → DB2: INSERT INTO sync_audit_log
4. On any DB2 error:
   - recordSyncFailure()      → DB1: sync_attempts++, last_sync_error = message
   - DB1 is_synced stays false → job is retried next cycle
5. After 5 failures → job excluded from future cycles (dead-letter)
```

---

## Duplicate Prevention

| Field | Behaviour |
|---|---|
| `is_synced = false` | Only unsynced jobs are fetched |
| `sync_attempts` | Incremented on each failure |
| `last_sync_error` | Last error message stored |
| `synced_at` | Timestamp set on success |
| `source_id UNIQUE` in DB2 | Prisma P2002 caught → treated as already synced |

---

## Transactional Safety

- DB2 inserts use `prisma.$transaction()` — all-or-nothing
- DB1 `is_synced` is set **ONLY** after the transaction commits
- If process crashes between DB2 commit and DB1 update:
  - Next cycle tries again → hits P2002 → safely marks DB1 done
- If DB2 fails mid-transaction → Prisma rolls back → DB1 untouched

---

## Folder Structure

```
sync-service/
├── src/
│   ├── config/
│   │   └── env.js
│   ├── database/
│   │   ├── db1.js          ← pg Pool → upwork_jobs
│   │   └── db2.js          ← Prisma → listing_site
│   ├── cron/
│   │   └── syncCron.js
│   ├── routes/
│   │   └── sync.routes.js
│   ├── controllers/
│   │   └── sync.controller.js
│   ├── services/
│   │   └── sync.service.js
│   ├── repositories/
│   │   ├── db1.repository.js
│   │   └── db2.repository.js
│   ├── middleware/
│   │   ├── error.middleware.js
│   │   └── requestLogger.middleware.js
│   ├── validators/
│   │   └── job.validator.js
│   ├── utils/
│   │   └── logger.js
│   ├── logs/               ← auto-created by Winston
│   └── app.js
├── prisma/
│   └── schema.prisma
├── package.json
├── .env
└── README.md
```

---

## Future Scalability

- Replace `setInterval` concurrency guard with **Redis Redlock** for multi-instance deployments
- Add **BullMQ** job queue — sync service becomes a producer, workers become consumers
- Add **Prometheus metrics** endpoint (`/metrics`) for sync cycle duration, error rates
- Add **Slack/webhook alerts** when a job hits `maxAttempts`
- **Horizontal scaling**: multiple sync service instances with Redis distributed lock
