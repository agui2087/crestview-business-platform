export type DocumentFinding = {
  id: string;
  source_document: string;
  metric_name: string;
  reported_value: string;
  normalized_value: number | null;
  period_label: string | null;
  source_url: string | null;
  confidence: string;
  review_status: string;
  notes: string | null;
};

export function findDocumentConflicts(findings: DocumentFinding[]) {
  const groups = new Map<string, DocumentFinding[]>();
  findings.forEach((finding) => {
    const key = `${finding.metric_name.trim().toLowerCase()}::${finding.period_label?.trim().toLowerCase() ?? "current"}`;
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  });
  return [...groups.values()].filter((items) => {
    if (items.length < 2) return false;
    const normalized = items.map((item) => item.normalized_value).filter((value): value is number => value !== null);
    if (normalized.length >= 2) return Math.max(...normalized) !== Math.min(...normalized);
    return new Set(items.map((item) => item.reported_value.trim().toLowerCase())).size > 1;
  });
}

export function buildCommandCenter(input: {
  diligence: Array<{ status: string; risk_level: string; title: string }>;
  evidenceCount: number;
  professionalsCount: number;
  transition: Array<{ status: string; title: string }>;
  lenderStatus: string | null;
  findings: DocumentFinding[];
}) {
  const openHighRisk = input.diligence.filter((item) => item.risk_level === "high" && item.status !== "verified");
  const requested = input.diligence.filter((item) => item.status === "requested");
  const received = input.diligence.filter((item) => item.status === "received");
  const nextTransition = input.transition.find((item) => item.status !== "complete");
  const conflicts = findDocumentConflicts(input.findings);
  const nextAction = conflicts[0]
    ? `Resolve conflicting ${conflicts[0][0].metric_name} figures`
    : received[0]
      ? `Verify received evidence: ${received[0].title}`
      : openHighRisk[0]
        ? `Address high-risk item: ${openHighRisk[0].title}`
        : requested[0]
          ? `Follow up on requested item: ${requested[0].title}`
          : nextTransition
            ? nextTransition.title
            : "Generate or update the deal-specific plan";
  return {
    nextAction,
    openHighRisk: openHighRisk.length,
    requested: requested.length,
    received: received.length,
    conflicts: conflicts.length,
    evidenceCount: input.evidenceCount,
    professionalsCount: input.professionalsCount,
    lenderStatus: input.lenderStatus ?? "not_started",
  };
}
