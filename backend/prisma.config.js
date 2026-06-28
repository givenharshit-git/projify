import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // The CLI utilizes the direct string to map structures securely without pooler timeouts
    url: env("DIRECT_URL"), 
  },
});
