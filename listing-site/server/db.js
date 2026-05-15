import { PrismaClient } from '@prisma/client';

let _prisma = null;

export function getDb() {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}
