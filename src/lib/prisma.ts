import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

if (typeof window === "undefined") {
  if (globalForPrisma.prisma) {
    prismaInstance = globalForPrisma.prisma;
  } else {
    // Resolve absolute path to dev.db in the project root to match prisma.config.ts CLI path
    const dbPath = path.join(process.cwd(), "dev.db");
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    
    prismaInstance = new PrismaClient({ adapter });
    
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaInstance;
    }
  }
} else {
  // Client side fallback (for build and safety checks)
  prismaInstance = null as unknown as PrismaClient;
}

export const prisma = prismaInstance;
