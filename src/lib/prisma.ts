import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

if (typeof window === "undefined") {
  if (globalForPrisma.prisma) {
    prismaInstance = globalForPrisma.prisma;
  } else {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is missing");
    }
    
    // 1. Create a pg connection pool
    const pool = new Pool({ connectionString });
    
    // 2. Initialize the adapter
    const adapter = new PrismaPg(pool);
    
    // 3. Instantiate the PrismaClient with the adapter
    prismaInstance = new PrismaClient({ adapter });
    
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaInstance;
    }
  }
} else {
  // Client side fallback (for build and compile checks)
  prismaInstance = null as unknown as PrismaClient;
}

export const prisma = prismaInstance;
