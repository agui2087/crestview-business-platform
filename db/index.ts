import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Document database is not connected.");
  return drizzle(env.DB, { schema });
}
