import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const origin = (process.env.CRESTVIEW_LOAD_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const authCookie = process.env.CRESTVIEW_LOAD_AUTH_COOKIE?.trim();
const outputPath = resolve(process.env.CRESTVIEW_LOAD_OUTPUT ?? "work/load-test-results.json");
const budgets = JSON.parse(await readFile(new URL("../config/performance-budgets.json", import.meta.url), "utf8"));
const results = [];

function percentile(values, amount) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * amount) - 1)];
}

async function request(url, init = {}) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "user-agent": "Crestview-Load-Test/1.0",
        ...(authCookie ? { cookie: authCookie } : {}),
        ...(init.headers ?? {}),
      },
    });
    await response.arrayBuffer();
    return { ok: response.ok, status: response.status, durationMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return { ok: false, status: 0, durationMs: Math.round(performance.now() - startedAt), error: error instanceof Error ? error.message : "request failed" };
  }
}

async function runScenario(scenario, operation) {
  const samples = [];
  let cursor = 0;
  async function worker() {
    while (cursor < scenario.requests) {
      const index = cursor++;
      samples.push(await operation(index));
    }
  }
  await Promise.all(Array.from({ length: scenario.concurrency }, () => worker()));
  const p95Ms = percentile(samples.map((sample) => sample.durationMs), 0.95);
  const failures = samples.filter((sample) => !sample.ok);
  const errorRate = failures.length / samples.length;
  const passed = p95Ms <= scenario.p95Ms && errorRate <= scenario.maxErrorRate;
  const result = {
    name: scenario.name,
    requests: samples.length,
    concurrency: scenario.concurrency,
    p50Ms: percentile(samples.map((sample) => sample.durationMs), 0.5),
    p95Ms,
    p99Ms: percentile(samples.map((sample) => sample.durationMs), 0.99),
    maxMs: Math.max(...samples.map((sample) => sample.durationMs)),
    errorRate,
    statuses: Object.fromEntries([...new Set(samples.map((sample) => sample.status))].map((status) => [status, samples.filter((sample) => sample.status === status).length])),
    budget: { p95Ms: scenario.p95Ms, maxErrorRate: scenario.maxErrorRate },
    passed,
  };
  results.push(result);
  console.log(`${passed ? "PASS" : "FAIL"} ${scenario.name}: p95 ${p95Ms}ms, ${(errorRate * 100).toFixed(1)}% errors`);
}

for (const scenario of budgets.public) {
  await runScenario(scenario, () => request(`${origin}${scenario.path}`));
}

if (authCookie) {
  for (const scenario of budgets.authenticated) {
    await runScenario(scenario, () => request(`${origin}${scenario.path}`));
  }
} else {
  console.log("SKIP authenticated scenarios: CRESTVIEW_LOAD_AUTH_COOKIE is not set.");
}

const uploadFile = process.env.CRESTVIEW_LOAD_UPLOAD_FILE;
if (uploadFile) {
  const hostname = new URL(origin).hostname;
  const isProduction = hostname === "crestviewplatform.com" || hostname.endsWith(".crestviewplatform.com") || hostname.endsWith(".chatgpt.site");
  if (!authCookie) throw new Error("CRESTVIEW_LOAD_AUTH_COOKIE is required for upload testing.");
  if (process.env.CRESTVIEW_LOAD_ALLOW_WRITES !== "staging") throw new Error("Set CRESTVIEW_LOAD_ALLOW_WRITES=staging to authorize temporary upload writes.");
  if (isProduction) throw new Error("Document upload load tests are blocked on production. Use an isolated staging environment.");
  const bytes = await readFile(resolve(uploadFile));
  const scenario = budgets.upload;
  await runScenario(scenario, async (index) => {
    const body = new FormData();
    body.append("file", new File([bytes], `load-test-${Date.now()}-${index}.pdf`, { type: "application/pdf" }));
    body.append("category", "Other");
    body.append("dealName", "Automated staging load test");
    const startedAt = performance.now();
    try {
      const response = await fetch(`${origin}/api/documents`, { method: "POST", body, headers: { cookie: authCookie, "user-agent": "Crestview-Load-Test/1.0" }, signal: AbortSignal.timeout(20_000) });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.id) await fetch(`${origin}/api/documents/${payload.id}`, { method: "DELETE", headers: { cookie: authCookie, "user-agent": "Crestview-Load-Test/1.0" }, signal: AbortSignal.timeout(15_000) });
      return { ok: response.ok, status: response.status, durationMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      return { ok: false, status: 0, durationMs: Math.round(performance.now() - startedAt), error: error instanceof Error ? error.message : "request failed" };
    }
  });
} else {
  console.log("SKIP document-upload scenario: CRESTVIEW_LOAD_UPLOAD_FILE is not set.");
}

const report = { generatedAt: new Date().toISOString(), origin, results, passed: results.every((result) => result.passed) };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map((result) => `| ${result.passed ? "✅" : "❌"} ${result.name} | ${result.requests} | ${result.concurrency} | ${result.p95Ms} ms | ${(result.errorRate * 100).toFixed(1)}% |`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, ["## Crestview load test", "", "| Scenario | Requests | Concurrency | p95 | Errors |", "| --- | ---: | ---: | ---: | ---: |", ...rows, ""].join("\n"));
}
if (!report.passed) process.exitCode = 1;
