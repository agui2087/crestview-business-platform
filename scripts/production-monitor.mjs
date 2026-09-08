import { appendFile } from "node:fs/promises";

const origin = (process.env.CRESTVIEW_MONITOR_ORIGIN ?? "https://www.crestviewplatform.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.CRESTVIEW_MONITOR_TIMEOUT_MS ?? 10_000);
const maxLatencyMs = Number(process.env.CRESTVIEW_MONITOR_MAX_LATENCY_MS ?? 2_500);
const retryDelayMs = Number(process.env.CRESTVIEW_MONITOR_RETRY_DELAY_MS ?? 10_000);

const checks = [
  { name: "Application health", path: "/api/health", json: true },
  { name: "English homepage", path: "/en" },
  { name: "Spanish homepage", path: "/es" },
  { name: "Marketplace", path: "/en/listings" },
  { name: "Pricing", path: "/en/pricing" },
];

async function checkEndpoint(check) {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${origin}${check.path}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "Crestview-Production-Monitor/1.0" },
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    let reason = response.ok ? "" : `HTTP ${response.status}`;

    if (check.json && response.ok) {
      const body = await response.json();
      if (body?.status !== "ok" || body?.services?.application !== "ok" || body?.services?.database !== "ok") {
        reason = "health response reported a degraded service";
      }
    }

    if (!reason && latencyMs > maxLatencyMs) reason = `latency ${latencyMs}ms exceeded ${maxLatencyMs}ms`;
    return { ...check, ok: !reason, status: response.status, latencyMs, reason };
  } catch (error) {
    return {
      ...check,
      ok: false,
      status: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      reason: error instanceof Error ? error.message : "request failed",
    };
  }
}

async function runChecks() {
  return Promise.all(checks.map(checkEndpoint));
}

function markdown(results, heading) {
  const rows = results.map((result) =>
    `| ${result.ok ? "✅" : "❌"} ${result.name} | ${result.status || "—"} | ${result.latencyMs} ms | ${result.reason || "Healthy"} |`,
  );
  return [
    `## ${heading}`,
    "",
    `Origin: \`${origin}\``,
    "",
    "| Check | HTTP | Time | Result |",
    "| --- | ---: | ---: | --- |",
    ...rows,
    "",
  ].join("\n");
}

let results = await runChecks();
if (results.some((result) => !result.ok)) {
  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  results = await runChecks();
}

const report = markdown(results, "Crestview production monitor");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);

if (results.some((result) => !result.ok)) process.exitCode = 1;
