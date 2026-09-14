import { appendFile } from "node:fs/promises";
import {checkEndpoint} from "./monitor-endpoint.mjs";

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

async function runChecks() {
  return Promise.all(checks.map(check=>checkEndpoint(check,{origin,timeoutMs,maxLatencyMs})));
}

function markdown(results, heading) {
  const rows = results.map((result) =>
    `| ${result.ok ? "PASS" : "FAIL"} ${result.name} | ${result.status || "—"} | ${result.latencyMs} ms | ${result.reason || "Healthy"} |`,
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
