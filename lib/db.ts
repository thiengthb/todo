import { PrismaClient } from "@prisma/client";

// Singleton — tránh tạo nhiều client khi Next hot-reload ở dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
