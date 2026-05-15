# Listing Site

Public job listing website. Reads **DB2** (`listing_site`) only.
Has zero knowledge of DB1 (`upwork_jobs`) — the iron wall holds.

Data arrives via the sync service every 15 seconds.

---

## Setup

### 1. Prerequisites
- Node.js 18+
- `listing_site` database already created and migrated by the sync-service

### 2. Install dependencies
```bash
cd listing-site
npm install
```

### 3. Generate Prisma client
```bash
npm run db:generate
```

> No `db:push` needed — the sync-service owns and migrates DB2.

### 4. Start
```bash
npm start        # http://localhost:3001
npm run dev      # auto-restart
```

---

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/jobs?page=1&limit=20&niche=&platform=&tool=` | List jobs (paginated + filtered) |
| `GET` | `/api/jobs/:id` | Job detail with all relations |
| `GET` | `/api/blogs?page=1&limit=20` | List blogs |
| `GET` | `/api/blogs/:id` | Blog detail |
| `GET` | `/api/products?page=1&limit=20` | List products |
| `GET` | `/api/products/:id` | Product detail |
| `GET` | `/api/services?page=1&limit=20` | List services |
| `GET` | `/api/services/:id` | Service detail |
| `GET` | `/api/stats` | Dashboard counts + last sync time |
| `GET` | `/api/audit?limit=50` | Sync audit log |

---

## Folder Structure

```
listing-site/
├── prisma/
│   └── schema.prisma     ← mirrors sync-service DB2 schema (read-only use)
├── public/
│   └── index.html        ← SPA frontend (vanilla JS, no build step)
├── server/
│   ├── db.js             ← Prisma client singleton
│   ├── routes/
│   │   ├── jobs.js
│   │   ├── blogs.js
│   │   ├── products.js
│   │   ├── services.js
│   │   └── audit.js
│   └── app.js            ← Express server
├── package.json
├── .env
└── README.md
```
