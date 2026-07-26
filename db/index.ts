import { drizzle } from "drizzle-orm/d1";

export async function getDb(): Promise<ReturnType<typeof drizzle>> {
  throw new Error("Online database storage is not connected.");
}
