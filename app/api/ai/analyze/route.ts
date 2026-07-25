import OpenAI from "openai";
import { z } from "zod";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

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
  if (!process.env.OPENAI_API_KEY || !isSupabaseConfigured()) {
    return Response.json({ error: "AI analysis is not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid analysis request." }, { status: 400 });

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

  return Response.json({
    dataCategory: "ai_generated",
    model: response.model,
    analysis: JSON.parse(response.output_text),
  });
}
