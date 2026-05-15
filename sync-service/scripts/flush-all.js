/**
 * flush-all.js
 *
 * Wipes all data from both DB1 (upwork_jobs) and DB2 (listing_site).
 *
 * DB1 — deletes all rows from: jobs_selected, product, blog, services
 * DB2 — truncates:             jobs, products, blogs, services,
 *                              sync_audit_log, sync_watermark
 *
 * Run from the sync-service directory:
 *   npm run flush
 *
 * ⚠  This is irreversible. Use with care.
 */

import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;

// ─── DB1 connection ────────────────────────────────────────────────────────
const db1 = new Pool({
  host:     process.env.DB1_HOST,
  port:     Number(process.env.DB1_PORT),
  database: process.env.DB1_DATABASE,
  user:     process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
});

// ─── DB2 connection ────────────────────────────────────────────────────────
const db2 = new Pool({
  host:     process.env.DB2_HOST,
  port:     Number(process.env.DB2_PORT),
  database: process.env.DB2_DATABASE,
  user:     process.env.DB2_USER,
  password: process.env.DB2_PASSWORD,
});

async function flush() {
  console.log('\n🚨  FLUSH ALL — wiping both databases\n');

  // ── DB1 ──────────────────────────────────────────────────────────────────
  console.log('── DB1 (upwork_jobs) ────────────────────────');
  try {
    await db1.query('SELECT 1'); // verify connection

    // Order matters — child tables first to respect any FK constraints
    const db1Tables = ['services', 'blog', 'product', 'jobs_selected'];
    for (const table of db1Tables) {
      const res = await db1.query(`DELETE FROM ${table}`);
      console.log(`  ✓ ${table.padEnd(16)} — ${res.rowCount} rows deleted`);
    }
  } catch (err) {
    console.error('  ✗ DB1 error:', err.message);
  }

  // ── DB2 ──────────────────────────────────────────────────────────────────
  console.log('\n── DB2 (listing_site) ───────────────────────');
  try {
    await db2.query('SELECT 1'); // verify connection

    // TRUNCATE CASCADE handles FK relationships automatically
    await db2.query(`
      TRUNCATE TABLE
        services,
        blogs,
        products,
        jobs,
        sync_audit_log,
        sync_watermark
      RESTART IDENTITY CASCADE
    `);
    console.log('  ✓ All DB2 tables truncated (identity sequences reset)');
  } catch (err) {
    console.error('  ✗ DB2 error:', err.message);
  }

  console.log('\n✅  Flush complete\n');

  await db1.end();
  await db2.end();
}

flush().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
