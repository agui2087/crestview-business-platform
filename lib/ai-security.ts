export const AI_ANALYSIS_HOURLY_LIMIT = 5;
export const AI_ANALYSIS_DAILY_LIMIT = 20;
export const AI_ANALYSIS_MAX_FACT_BYTES = 50_000;

export function isAiAnalysisEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.CRESTVIEW_AI_ANALYSIS_ENABLED === "true";
}

export function serializedByteLength(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function isAiAnalysisPayloadAllowed(value: unknown) {
  return serializedByteLength(value) <= AI_ANALYSIS_MAX_FACT_BYTES;
}
