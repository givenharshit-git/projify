import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

// 1. Tell Neon how to manage WebSockets globally inside your serverless runtime
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
console.log(connectionString);
if (!connectionString) {
  throw new Error("DATABASE_URL variable is missing inside environment mappings.");
}

const adapter = new PrismaNeon({ connectionString });

// Prevent multiple instances of Prisma Client from freezing connections during hot-reloads
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}