import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type CloudflareRuntime = CloudflareEnv & Record<string, unknown>;

async function getCloudflareRuntime(): Promise<CloudflareRuntime> {
  // Keep the Cloudflare-only module out of Vercel's build graph. The module is
  // resolved at runtime only when a D1 or R2-backed route is actually used.
  const load = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<{ env: CloudflareRuntime }>;
  try {
    return (await load("cloudflare:workers")).env;
  } catch {
    throw new Error("Online document storage is unavailable in this deployment.");
  }
}

export async function getDb() {
  const runtime = await getCloudflareRuntime();
  if (!runtime.DB) throw new Error("Online database storage is unavailable.");
  return drizzle(runtime.DB, { schema });
}

export async function getDocumentStorage() {
  const runtime = await getCloudflareRuntime();
  if (!runtime.DOCUMENTS) throw new Error("Online document storage is unavailable.");
  return runtime.DOCUMENTS;
}
