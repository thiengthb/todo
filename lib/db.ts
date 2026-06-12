import { PrismaClient } from '@prisma/client';

// Singleton — avoid creating multiple clients during Next hot-reload in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
