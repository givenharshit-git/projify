import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

// 1. Tell Neon how to manage WebSockets globally inside your serverless runtime
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL variable is missing inside environment mappings.");
}

// 2. Open an optimized serverless connection pool 
const pool = new Pool({ connectionString });

// 3. Bind the Neon connection pool into the Prisma Adapter structure
const adapter = new PrismaNeon(pool);

// 4. Feed the driver adapter directly to Prisma Client
export const prisma = new PrismaClient({ adapter });