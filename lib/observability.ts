type LogLevel = "info" | "warn" | "error";

type OperationalEvent = {
  event: string;
  level?: LogLevel;
  requestId?: string;
  route?: string;
  message?: string;
  error?: unknown;
  details?: Record<string, unknown>;
};

const sensitiveKeyPattern = /authorization|cookie|password|secret|token|api[-_]?key|signature|email|phone|name|address|document|financial/i;

function safeError(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  return {
    name: error.name,
    message: error.message.slice(0, 300),
    digest: "digest" in error && typeof error.digest === "string" ? error.digest : undefined,
  };
}

export function redactForLogs(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactForLogs(item, depth + 1));
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[redacted]" : redactForLogs(item, depth + 1),
    ]),
  );
}

export function logOperationalEvent(input: OperationalEvent) {
  const level = input.level ?? "info";
  const payload = {
    timestamp: new Date().toISOString(),
    service: "crestview-web",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    event: input.event,
    requestId: input.requestId,
    route: input.route,
    message: input.message?.slice(0, 300),
    error: safeError(input.error),
    details: redactForLogs(input.details),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function createRequestId() {
  return crypto.randomUUID();
}
