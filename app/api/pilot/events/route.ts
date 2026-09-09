import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { recordPilotEvent } from "@/lib/pilot-telemetry";

export const runtime = "nodejs";

const schema = z.object({
  eventName: z.string().regex(/^[a-z0-9_.-]{1,80}$/),
  route: z.string().min(1).max(500),
  metadata: z.record(z.string(), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: NextRequest) {
  if (process.env.CRESTVIEW_PILOT_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid pilot event." }, { status: 400 });
  await recordPilotEvent({ userId: user.id, ...parsed.data });
  return new NextResponse(null, { status: 204 });
}
