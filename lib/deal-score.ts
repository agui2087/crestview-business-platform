import type { Opportunity } from "@/lib/demo-data";

export const SCORE_VERSION = "1.0";

export function calculateDealScore(item: Opportunity) {
  const factors = [
    { label: "Cash flow disclosed", weight: 20, earned: item.cashFlowValue !== null ? 20 : 0 },
    { label: "Revenue disclosed", weight: 15, earned: item.revenueValue !== null ? 15 : 0 },
    { label: "Price disclosed", weight: 15, earned: item.priceValue !== null ? 15 : 0 },
    { label: "Reasonable price to cash flow", weight: 20, earned: item.priceValue && item.cashFlowValue ? (item.priceValue / item.cashFlowValue <= 3.5 ? 20 : item.priceValue / item.cashFlowValue <= 5 ? 10 : 2) : 0 },
    { label: "Operating history or market evidence", weight: 10, earned: item.highlights.length >= 2 ? 10 : 4 },
    { label: "Seller financing signal", weight: 5, earned: item.highlights.some((value) => value.toLowerCase().includes("seller financ")) ? 5 : 0 },
    { label: "Data completeness", weight: 15, earned: Math.max(0, 15 - item.missing.length * 2) },
  ];
  const score = Math.round(factors.reduce((sum, factor) => sum + factor.earned, 0));
  const confidence = item.missing.length <= 2 ? "High" : item.missing.length <= 4 ? "Medium" : "Low";
  return { score, confidence, version: SCORE_VERSION, factors };
}
