export type LogLevel = "info" | "warn" | "error";

export type OperationalEvent = {
  event: string;
  level?: LogLevel;
  requestId?: string;
  route?: string;
  message?: string;
  error?: unknown;
  details?: Record<string, unknown>;
};

type AlertOptions = {
  webhookUrl?: string;
  webhookToken?: string;
  fetchImpl?: typeof fetch;
};

const sensitiveKeyPattern = /authorization|cookie|password|secret|token|api[-_]?key|signature|email|phone|name|address|document|financial/i;

function safeError(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  return {
    name: error.name,
    code: "code" in error && ["string", "number"].includes(typeof error.code) ? String(error.code).slice(0, 80) : undefined,
    digest: "digest" in error && typeof error.digest === "string" ? error.digest : undefined,
  };
}

function safeMessage(value: string | undefined) {
  if (!value) return undefined;
  return value
    .slice(0, 300)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(bearer|apikey|token|secret|password)\s*[:=]?\s*[^\s,;]+/gi, "$1 [redacted]")
    .replace(/https?:\/\/[^\s?#]+\?[^\s]+/gi, "[redacted-url]");
}

function payloadFor(input: OperationalEvent) {
  return {
    timestamp: new Date().toISOString(),
    service: "crestview-web",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    event: input.event.slice(0, 120),
    requestId: input.requestId?.slice(0, 120),
    route: input.route?.slice(0, 240),
    message: safeMessage(input.message),
    error: safeError(input.error),
    details: redactForLogs(input.details),
  };
}

function writeOperationalEvent(level: LogLevel, payload: ReturnType<typeof payloadFor>) {
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
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
  writeOperationalEvent(level, payloadFor(input));
}

/**
 * Records an operational event and delivers error-level events to the optional
 * incident webhook. Alert delivery never replaces the original operation and
 * never exposes request bodies or credentials.
 */
export async function reportOperationalEvent(input: OperationalEvent, options: AlertOptions = {}) {
  const level = input.level ?? "info";
  const payload = payloadFor(input);
  writeOperationalEvent(level, payload);
  if (level !== "error") return;

  const webhookUrl = options.webhookUrl ?? process.env.CRESTVIEW_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
    if (parsedUrl.protocol !== "https:") throw new Error("Alert webhook must use HTTPS.");
  } catch (error) {
    writeOperationalEvent("error", payloadFor({ event: "alert.configuration_invalid", level: "error", error }));
    return;
  }

  const webhookToken = options.webhookToken ?? process.env.CRESTVIEW_ALERT_WEBHOOK_TOKEN;
  try {
    const response = await (options.fetchImpl ?? fetch)(parsedUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(webhookToken ? { authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({
        text: `[${payload.environment}] ${payload.event}${payload.route ? ` on ${payload.route}` : ""}`,
        ...payload,
      }),
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`Alert receiver returned HTTP ${response.status}.`);
  } catch (error) {
    writeOperationalEvent("error", payloadFor({
      event: "alert.delivery_failed",
      level: "error",
      error,
      details: { sourceEvent: payload.event },
    }));
  }
}

export function createRequestId() {
  return crypto.randomUUID();
}
