import { z } from "zod";

const money = z.string().trim().transform((raw, ctx) => {
  if (!raw) return null;
  const normalized = raw.replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized) || Number(normalized) > 1e12) {
    ctx.addIssue({ code: "custom", message: "Enter a nonnegative amount with at most two decimal places." });
    return z.NEVER;
  }
  return Number(normalized);
});
const list = z.string().max(4000).transform(value => [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))])
  .pipe(z.array(z.string().max(100)).max(30));
const sharing = z.enum(["private", "nda", "inquiry"]);
export const buyerProfileSchema = z.object({
  industries: list,
  locations: list,
  minimum_price: money,
  maximum_price: money,
  minimum_cash_flow: money,
  desired_owner_income: money,
  available_cash: money,
  buyer_injection_percent: z.coerce.number().min(5).max(50),
  illustrative_interest_rate: z.coerce.number().min(0).max(30),
  owner_involvement: z.enum(["flexible", "owner_operator", "semi_absentee", "absentee"]),
  experience_level: z.enum(["first_time", "experienced", "professional"]),
  acquisition_timeline: z.enum(["within_90_days", "within_6_months", "within_12_months", "exploring"]),
  funding_status: z.enum(["cash_ready", "prequalified", "exploring", "seller_financing"]),
  credit_readiness: z.enum(["not_provided", "building", "fair", "good", "excellent"]),
  risk_tolerance: z.enum(["conservative", "balanced", "growth"]),
  buyer_summary: z.string().trim().max(3000).transform(value => value || null),
  seller_financing_preferred: z.boolean(),
  proof_of_funds_status: z.enum(["available", "not_provided"]),
  share_summary: sharing,
  share_experience: sharing,
  share_financial: sharing,
}).refine(data => data.minimum_price === null || data.maximum_price === null || data.minimum_price <= data.maximum_price,
  { path: ["maximum_price"], message: "Maximum asking price must be at least the minimum." });

export function parseBuyerProfile(form: FormData) {
  return buyerProfileSchema.safeParse({
    ...Object.fromEntries(form),
    seller_financing_preferred: form.get("seller_financing_preferred") === "on",
    proof_of_funds_status: form.get("proof_of_funds_available") === "on" ? "available" : "not_provided",
  });
}
