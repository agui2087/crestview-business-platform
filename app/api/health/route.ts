import { NextResponse } from "next/server";
import { logOperationalEvent } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  let database: "ok" | "unavailable" = "unavailable";

  try {
    const { error } = await createSupabaseAdminClient()
      .from("account_profiles")
      .select("id", { head: true, count: "exact" })
      .abortSignal(AbortSignal.timeout(2500));
    if (!error) database = "ok";
  } catch (error) {
    logOperationalEvent({ event: "health.database_failed", level: "error", route: "/api/health", error });
  }

  const healthy = database === "ok";
  const response = NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checkedAt,
      durationMs: Date.now() - startedAt,
      services: { application: "ok", database },
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    },
    { status: healthy ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
