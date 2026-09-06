import OpenAI from "openai";
import { z } from "zod";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  AI_ANALYSIS_DAILY_LIMIT,
  AI_ANALYSIS_HOURLY_LIMIT,
  isAiAnalysisEnabled,
  isAiAnalysisPayloadAllowed,
} from "@/lib/ai-security";

const requestSchema = z.object({
  opportunityId: z.string().uuid(),
  sourceFacts: z.record(z.string(), z.unknown()),
});

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    growthOpportunities: { type: "array", items: { type: "string" } },
    missingInformation: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["executiveSummary", "strengths", "weaknesses", "risks", "growthOpportunities", "missingInformation", "confidence"],
};

export async function POST(request: Request) {
  if (!isAiAnalysisEnabled() || !process.env.OPENAI_API_KEY || !isSupabaseConfigured()) {
    return Response.json({ error: "AI analysis is not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid analysis request." }, { status: 400 });
  if (!isAiAnalysisPayloadAllowed(parsed.data.sourceFacts)) {
    return Response.json({ error: "Analysis input is too large." }, { status: 413 });
  }

  const admin = createSupabaseAdminClient();
  const { data: reservation, error: reservationError } = await admin.rpc("reserve_ai_analysis", {
    p_user_id: user.id,
    p_opportunity_id: parsed.data.opportunityId,
    p_hourly_limit: AI_ANALYSIS_HOURLY_LIMIT,
    p_daily_limit: AI_ANALYSIS_DAILY_LIMIT,
  });
  if (reservationError) {
    const message = reservationError.message.toLowerCase();
    if (message.includes("entitlement")) return Response.json({ error: "Crestview Pro is required." }, { status: 403 });
    if (message.includes("opportunity")) return Response.json({ error: "Opportunity access denied." }, { status: 403 });
    if (message.includes("rate limit")) return Response.json({ error: "Analysis limit reached. Try again later." }, { status: 429 });
    return Response.json({ error: "Analysis could not be authorized." }, { status: 503 });
  }

  const reservationId = String(reservation);

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: "gpt-5.6-sol",
      reasoning: { effort: "low" },
      input: [
        {
          role: "developer",
          content: "Analyze only the supplied source facts. Separate missing information from negative facts. Do not invent values or present inference as verified fact.",
        },
        { role: "user", content: JSON.stringify(parsed.data.sourceFacts) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "opportunity_analysis",
          strict: true,
          schema: analysisSchema,
        },
      },
    });

    await admin.from("ai_analysis_usage").update({ status: "completed", provider_response_id: response.id, completed_at: new Date().toISOString() }).eq("id", reservationId);

    return Response.json({
      dataCategory: "ai_generated",
      model: response.model,
      analysis: JSON.parse(response.output_text),
    });
  } catch {
    await admin.from("ai_analysis_usage").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", reservationId);
    return Response.json({ error: "Analysis failed. No results were saved." }, { status: 502 });
  }
}
