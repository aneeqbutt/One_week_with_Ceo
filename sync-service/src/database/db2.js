// ─── DB2 connector ────────────────────────────────────────────────────────────
// Prisma client for the listing_site database.
// Prisma manages the full schema via migrations — the sync service owns DB2
// completely. The listing website reads DB2 with its own separate Prisma client
// and never holds a reference to this module.

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

let _prisma = null;

export function getDb2Client() {
  if (_prisma) return _prisma;

  _prisma = new PrismaClient({
    log: [
      { level: 'warn',  emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

  _prisma.$on('warn',  (e) => logger.warn('Prisma/DB2 warning', { message: e.message }));
  _prisma.$on('error', (e) => logger.error('Prisma/DB2 error',  { message: e.message }));

  return _prisma;
}

export async function connectDb2() {
  const client = getDb2Client();
  await client.$connect();
  logger.info('DB2 connected (Prisma → listing_site)');
  return client;
}

export async function closeDb2() {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
    logger.info('DB2 disconnected');
  }
}
