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

export type DealLocale = "en" | "es";

const lenderStatusLabels: Record<string, Record<DealLocale, string>> = {
  not_started: { en: "Not started", es: "No iniciado" },
  preparing: { en: "Preparing", es: "Preparando" },
  prequalified: { en: "Prequalified", es: "Precalificado" },
  submitted: { en: "Submitted", es: "Enviado" },
  approved: { en: "Approved", es: "Aprobado" },
};

export function formatLenderStatus(status: string | null | undefined, locale: DealLocale) {
  const key = status ?? "not_started";
  return lenderStatusLabels[key]?.[locale] ?? key.replaceAll("_", " ");
}

export function formatSupportLevel(value: string, locale: DealLocale) {
  const labels: Record<string, Record<DealLocale, string>> = {
    document_supported: { en: "Document supported", es: "Respaldado por documento" },
    buyer_entered: { en: "Buyer entered", es: "Ingresado por comprador" },
    professional_confirmed: { en: "Professional review noted", es: "Revisión profesional registrada" },
  };
  return labels[value]?.[locale] ?? value.replaceAll("_", " ");
}

export function formatReviewStatus(value: string, locale: DealLocale) {
  const labels: Record<string, Record<DealLocale, string>> = {
    unreviewed: { en: "Unreviewed", es: "Sin revisar" },
    reviewed: { en: "Reviewed", es: "Revisado" },
    confirmed: { en: "Review confirmed", es: "Revisión confirmada" },
    conflict: { en: "Conflict flagged", es: "Conflicto señalado" },
  };
  return labels[value]?.[locale] ?? value.replaceAll("_", " ");
}

export function passportMetrics(input: {
  findings: DocumentFinding[];
  evidenceCount: number;
}) {
  const documentSupportedFindings = input.findings.filter((item) => item.confidence === "document_supported").length;
  const reviewConfirmedFindings = input.findings.filter((item) => item.review_status === "confirmed").length;
  return {
    documentSupportedClaims: input.evidenceCount + documentSupportedFindings,
    reviewConfirmedClaims: reviewConfirmedFindings,
  };
}

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
  locale?: DealLocale;
}) {
  const locale = input.locale ?? "en";
  const es = locale === "es";
  const openHighRisk = input.diligence.filter((item) => item.risk_level === "high" && item.status !== "verified");
  const requested = input.diligence.filter((item) => item.status === "requested");
  const received = input.diligence.filter((item) => item.status === "received");
  const nextTransition = input.transition.find((item) => item.status !== "complete");
  const conflicts = findDocumentConflicts(input.findings);
  const nextAction = conflicts[0]
    ? es
      ? `Resolver cifras conflictivas de ${conflicts[0][0].metric_name}`
      : `Resolve conflicting ${conflicts[0][0].metric_name} figures`
    : received[0]
      ? es
        ? `Verificar evidencia recibida: ${received[0].title}`
        : `Verify received evidence: ${received[0].title}`
      : openHighRisk[0]
        ? es
          ? `Atender elemento de alto riesgo: ${openHighRisk[0].title}`
          : `Address high-risk item: ${openHighRisk[0].title}`
        : requested[0]
          ? es
            ? `Dar seguimiento al elemento solicitado: ${requested[0].title}`
            : `Follow up on requested item: ${requested[0].title}`
          : nextTransition
            ? nextTransition.title
            : es
              ? "Generar o actualizar el plan específico del trato"
              : "Generate or update the deal-specific plan";
  return {
    nextAction,
    lenderStatusLabel: formatLenderStatus(input.lenderStatus, locale),
    openHighRisk: openHighRisk.length,
    requested: requested.length,
    received: received.length,
    conflicts: conflicts.length,
    evidenceCount: input.evidenceCount,
    professionalsCount: input.professionalsCount,
    lenderStatus: input.lenderStatus ?? "not_started",
  };
}

export function normalizeBuyerFindingConfidence(value: string | null | undefined) {
  return value === "buyer_entered" ? "buyer_entered" : "document_supported";
}
