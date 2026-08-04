import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommandCenter,
  findDocumentConflicts,
  formatReviewStatus,
  normalizeBuyerFindingConfidence,
  passportMetrics,
} from "./deal-intelligence.ts";

test("findDocumentConflicts detects normalized value mismatches", () => {
  const conflicts = findDocumentConflicts([
    {
      id: "1",
      source_document: "Tax return",
      metric_name: "Revenue",
      reported_value: "$800,000",
      normalized_value: 800000,
      period_label: "2024",
      source_url: null,
      confidence: "document_supported",
      review_status: "unreviewed",
      notes: null,
    },
    {
      id: "2",
      source_document: "P&L",
      metric_name: "Revenue",
      reported_value: "$850,000",
      normalized_value: 850000,
      period_label: "2024",
      source_url: null,
      confidence: "document_supported",
      review_status: "unreviewed",
      notes: null,
    },
  ]);
  assert.equal(conflicts.length, 1);
});

test("passportMetrics excludes completed diligence tasks from review-confirmed claims", () => {
  const metrics = passportMetrics({
    evidenceCount: 2,
    findings: [
      {
        id: "1",
        source_document: "Tax return",
        metric_name: "Revenue",
        reported_value: "$800,000",
        normalized_value: 800000,
        period_label: "2024",
        source_url: null,
        confidence: "document_supported",
        review_status: "confirmed",
        notes: null,
      },
      {
        id: "2",
        source_document: "Notes",
        metric_name: "Margin",
        reported_value: "18%",
        normalized_value: 18,
        period_label: null,
        source_url: null,
        confidence: "buyer_entered",
        review_status: "unreviewed",
        notes: null,
      },
    ],
  });
  assert.equal(metrics.reviewConfirmedClaims, 1);
  assert.equal(metrics.documentSupportedClaims, 3);
});

test("buildCommandCenter localizes next actions in Spanish", () => {
  const command = buildCommandCenter({
    locale: "es",
    diligence: [{ status: "requested", risk_level: "medium", title: "Revisar contratos" }],
    evidenceCount: 0,
    professionalsCount: 0,
    transition: [],
    lenderStatus: "not_started",
    findings: [],
  });
  assert.match(command.nextAction, /Dar seguimiento al elemento solicitado/);
});

test("normalizeBuyerFindingConfidence blocks professional confirmation", () => {
  assert.equal(normalizeBuyerFindingConfidence("professional_confirmed"), "document_supported");
  assert.equal(normalizeBuyerFindingConfidence("buyer_entered"), "buyer_entered");
});

test("formatReviewStatus uses review-status language", () => {
  assert.equal(formatReviewStatus("confirmed", "en"), "Review confirmed");
  assert.equal(formatReviewStatus("confirmed", "es"), "Revisión confirmada");
});
