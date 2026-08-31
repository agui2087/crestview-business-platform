import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  const runtime = env as typeof env & CloudflareEnv;
  if (!runtime.DB) throw new Error("Online database storage is unavailable.");
  return drizzle(runtime.DB, { schema });
}

export function getDocumentStorage() {
  const runtime = env as typeof env & CloudflareEnv;
  if (!runtime.DOCUMENTS) throw new Error("Online document storage is unavailable.");
  return runtime.DOCUMENTS;
}
