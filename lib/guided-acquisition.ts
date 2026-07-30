export type GuidanceProfile = {
  industry_type: string;
  purchase_structure: string;
  financing_type: string;
  state_code: string;
  has_employees: boolean;
  includes_real_estate: boolean;
  includes_inventory: boolean;
  first_acquisition: boolean;
};

export type GuidedItem = {
  category: string;
  title: string;
  phase: string;
  reason: string;
  guidance_source: "crestview" | "government";
  source_url?: string;
  risk_level: "low" | "medium" | "high";
  assigned_role: string;
};

export function buildGuidedChecklist(profile: GuidanceProfile): GuidedItem[] {
  const items: GuidedItem[] = [
    { category: "Financial", title: "Reconcile tax returns to financial statements", phase: "verify", reason: "Confirms reported earnings agree across source records.", guidance_source: "crestview", risk_level: "high", assigned_role: "accountant" },
    { category: "Financial", title: "Trace revenue to bank deposits", phase: "verify", reason: "Tests whether reported sales are supported by cash activity.", guidance_source: "crestview", risk_level: "high", assigned_role: "accountant" },
    { category: "Legal", title: "Review contracts, liens, litigation, and entity records", phase: "protect", reason: "Identifies obligations or claims that may follow the transaction.", guidance_source: "government", source_url: "https://www.sba.gov/business-guide/buy-assets-equipment/buy-existing-business-or-franchise", risk_level: "high", assigned_role: "attorney" },
    { category: "Customer", title: "Measure customer concentration and retention", phase: "verify", reason: "Shows how dependent the company is on a small number of buyers.", guidance_source: "crestview", risk_level: "medium", assigned_role: "buyer" },
    { category: "Operational", title: "Document owner duties and transition support", phase: "plan", reason: "Prevents key responsibilities from disappearing after closing.", guidance_source: "crestview", risk_level: "medium", assigned_role: "buyer" },
  ];
  if (profile.has_employees) items.push(
    { category: "Employee", title: "Review payroll, benefits, classifications, and retention risk", phase: "verify", reason: "Employee costs and continuity affect cash flow and operations.", guidance_source: "government", source_url: "https://www.dol.gov/general/topic/wages", risk_level: "high", assigned_role: "attorney" },
  );
  if (profile.includes_real_estate) items.push(
    { category: "Legal", title: "Inspect title, zoning, environmental, and property condition records", phase: "protect", reason: "Real estate adds title, use, environmental, and capital expense risks.", guidance_source: "government", source_url: "https://www.epa.gov/brownfields", risk_level: "high", assigned_role: "attorney" },
  );
  if (profile.includes_inventory) items.push(
    { category: "Operational", title: "Count inventory and identify obsolete or unsellable stock", phase: "verify", reason: "The purchase price should reflect usable inventory, not just book value.", guidance_source: "crestview", risk_level: "medium", assigned_role: "buyer" },
  );
  if (profile.purchase_structure === "asset") items.push(
    { category: "Tax", title: "Agree on asset allocation and tax treatment", phase: "protect", reason: "Allocation can materially change taxes and depreciation for both parties.", guidance_source: "government", source_url: "https://www.irs.gov/forms-pubs/about-form-8594", risk_level: "high", assigned_role: "accountant" },
  );
  if (profile.purchase_structure === "stock") items.push(
    { category: "Legal", title: "Review inherited entity liabilities and ownership records", phase: "protect", reason: "A stock purchase generally carries the existing entity and its history.", guidance_source: "crestview", risk_level: "high", assigned_role: "attorney" },
  );
  if (profile.financing_type === "sba") items.push(
    { category: "Financing", title: "Prepare lender package and confirm SBA eligibility", phase: "finance", reason: "A complete package reduces lender delays and surfaces financing gaps early.", guidance_source: "government", source_url: "https://www.sba.gov/funding-programs/loans/7a-loans", risk_level: "high", assigned_role: "lender" },
  );
  if (profile.first_acquisition) items.push(
    { category: "Planning", title: "Confirm personal liquidity and post-close operating reserve", phase: "finance", reason: "First-time buyers often underestimate closing costs and early working capital.", guidance_source: "crestview", risk_level: "medium", assigned_role: "buyer" },
  );
  return items;
}

export function readinessSummary(items: Array<{ category: string; status: string; risk_level?: string }>) {
  const active = items.filter((item) => item.status !== "not_applicable");
  const completed = active.filter((item) => item.status === "verified").length;
  const evidence = active.filter((item) => ["received", "verified"].includes(item.status)).length;
  const highRisks = active.filter((item) => item.risk_level === "high" && item.status !== "verified").length;
  const progress = active.length ? Math.round((completed / active.length) * 100) : 0;
  const evidenceProgress = active.length ? Math.round((evidence / active.length) * 100) : 0;
  return { progress, evidenceProgress, highRisks, total: active.length, completed };
}

export function calculateSbaReadiness(input: {
  purchase_price: number; buyer_injection: number; seller_note: number; working_capital: number;
  annual_cash_flow: number; interest_rate: number; term_years: number;
}) {
  const loan = Math.max(0, input.purchase_price + input.working_capital - input.buyer_injection - input.seller_note);
  const monthlyRate = input.interest_rate / 100 / 12;
  const months = Math.max(12, input.term_years * 12);
  const monthlyPayment = loan === 0 ? 0 : monthlyRate === 0 ? loan / months : loan * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  const annualDebt = monthlyPayment * 12;
  const dscr = annualDebt > 0 ? input.annual_cash_flow / annualDebt : 0;
  const injectionPercent = input.purchase_price > 0 ? input.buyer_injection / input.purchase_price * 100 : 0;
  return { loan, annualDebt, dscr, injectionPercent };
}
