import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createRequestId, reportOperationalEvent } from "@/lib/observability";
import { normalizePilotRoute, recordPilotEvent } from "@/lib/pilot-telemetry";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  route: z.string().min(1).max(500),
  taskArea: z.enum(["search", "listing", "nda", "documents", "dashboard", "billing", "other"]),
  sentiment: z.enum(["blocked", "difficult", "neutral", "easy"]),
  comments: z.string().trim().min(1).max(2000),
  contactPermission: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  if (process.env.CRESTVIEW_PILOT_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const requestId = createRequestId();
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required.", requestId }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please complete each required field.", requestId }, { status: 400 });
  if (!user.id || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "Pilot feedback is available in the connected pilot environment.", requestId }, { status: 503 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const route = normalizePilotRoute(parsed.data.route);
    const { error } = await supabase.from("pilot_feedback").insert({
      user_id: user.id,
      route,
      task_area: parsed.data.taskArea,
      sentiment: parsed.data.sentiment,
      comments: parsed.data.comments,
      contact_permission: parsed.data.contactPermission,
    });
    if (error) throw error;
    await recordPilotEvent({ userId: user.id, eventName: "pilot.feedback_submitted", route, metadata: { taskArea: parsed.data.taskArea, sentiment: parsed.data.sentiment } });
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    await reportOperationalEvent({ event: "pilot.feedback_failed", level: "error", requestId, route: "/api/pilot/feedback", error });
    return NextResponse.json({ error: "Feedback could not be saved. Please try again.", requestId }, { status: 503 });
  }
}
