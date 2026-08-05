import type { Opportunity } from "@/lib/demo-data";

export const SCORE_VERSION = "1.0";

export type BuyerFitPreferences = {
  industries: string[];
  locations: string[];
  maximum_price: number | null;
  minimum_cash_flow: number | null;
  seller_financing_preferred: boolean;
} | null;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function calculateBuyerFit(item: Opportunity, preferences: BuyerFitPreferences) {
  if (!preferences) return null;
  const factors: Array<{ label: string; status: "match" | "review" | "unknown"; detail: string; weight: number; earned: number }> = [];
  if (preferences.industries.length) {
    const match = preferences.industries.some((value) => normalize(item.industry).includes(normalize(value)) || normalize(item.title).includes(normalize(value)));
    factors.push({ label: "Industry", status: match ? "match" : "review", detail: match ? "Matches a preferred industry" : "Outside your saved industries", weight: 25, earned: match ? 25 : 0 });
  }
  if (preferences.locations.length) {
    const match = preferences.locations.some((value) => normalize(item.location).includes(normalize(value)) || normalize(value).includes(normalize(item.location)));
    factors.push({ label: "Location", status: match ? "match" : "review", detail: match ? "Matches a preferred area" : "Outside your saved locations", weight: 20, earned: match ? 20 : 0 });
  }
  if (preferences.maximum_price) {
    const known = item.priceValue !== null;
    const match = known && item.priceValue! <= preferences.maximum_price;
    factors.push({ label: "Budget", status: !known ? "unknown" : match ? "match" : "review", detail: !known ? "Price not disclosed" : match ? "Within your saved maximum" : "Above your saved maximum", weight: 25, earned: match ? 25 : 0 });
  }
  if (preferences.minimum_cash_flow) {
    const known = item.cashFlowValue !== null;
    const match = known && item.cashFlowValue! >= preferences.minimum_cash_flow;
    factors.push({ label: "Cash flow", status: !known ? "unknown" : match ? "match" : "review", detail: !known ? "Cash flow not disclosed" : match ? "Meets your saved target" : "Below your saved target", weight: 25, earned: match ? 25 : 0 });
  }
  if (preferences.seller_financing_preferred) {
    const match = item.highlights.some((value) => normalize(value).includes("seller financ"));
    factors.push({ label: "Seller financing", status: match ? "match" : "unknown", detail: match ? "Mentioned in the listing" : "Not confirmed; ask the broker", weight: 5, earned: match ? 5 : 0 });
  }
  const possible = factors.reduce((sum, factor) => sum + factor.weight, 0);
  if (!possible) return null;
  const score = Math.round((factors.reduce((sum, factor) => sum + factor.earned, 0) / possible) * 100);
  const matched = factors.filter((factor) => factor.status === "match").length;
  const needsReview = factors.filter((factor) => factor.status !== "match").length;
  return { score, factors, matched, needsReview };
}

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
