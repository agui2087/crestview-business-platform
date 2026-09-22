export type BuyerFinanceInputs = {
  availableCash: number;
  desiredOwnerIncome: number;
  injectionPercent: number;
  interestRate: number;
  termYears?: number;
  reservePercent?: number;
};

export function savedBuyerFinanceInputs(profile:{available_cash:number|null;buyer_injection_percent:number;illustrative_interest_rate:number}|null,desiredOwnerIncome:number):BuyerFinanceInputs|null {
  if(profile?.available_cash===null||profile?.available_cash===undefined)return null;
  return {availableCash:profile.available_cash,desiredOwnerIncome,injectionPercent:profile.buyer_injection_percent,interestRate:profile.illustrative_interest_rate};
}

function annualDebtPayment(principal: number, annualRate: number, years: number) {
  if (principal <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  const monthly = monthlyRate === 0
    ? principal / months
    : principal * (monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1);
  return monthly * 12;
}

export function estimateBuyerRange(inputs: BuyerFinanceInputs) {
  const injection = Math.min(50, Math.max(5, inputs.injectionPercent)) / 100;
  const reserve = Math.min(25, Math.max(0, inputs.reservePercent ?? 5)) / 100;
  const maxPurchasePrice = inputs.availableCash > 0 ? inputs.availableCash / (injection + reserve) : 0;
  const estimatedLoan = maxPurchasePrice * (1 - injection);
  const annualDebtService = annualDebtPayment(estimatedLoan, inputs.interestRate, inputs.termYears ?? 10);
  const suggestedMinimumCashFlow = inputs.desiredOwnerIncome + annualDebtService * 1.25;
  return { maxPurchasePrice, estimatedLoan, annualDebtService, suggestedMinimumCashFlow, injection, reserve };
}

export function financialFitForDeal(price: number | null, cashFlow: number | null, inputs: BuyerFinanceInputs | null) {
  if (!inputs) return { score: null, status: "unknown" as const, reasons: ["Save your cash and financing assumptions to estimate financial fit."] };
  if (price===null||!Number.isFinite(price)||price<=0) return { score: null, status: "unknown" as const, reasons: ["A positive listing asking price is needed to estimate financial fit."] };
  const injection = Math.min(50, Math.max(5, inputs.injectionPercent)) / 100;
  const cashNeeded = price * (injection + (inputs.reservePercent ?? 5) / 100);
  const annualDebtService = annualDebtPayment(price * (1 - injection), inputs.interestRate, inputs.termYears ?? 10);
  const requiredCashFlow = inputs.desiredOwnerIncome + annualDebtService * 1.25;
  const reasons: string[] = [];
  let score = 0;
  if (inputs.availableCash >= cashNeeded) { score += 45; reasons.push("Estimated cash need is within your saved amount."); }
  else reasons.push(`Estimated cash need exceeds your saved amount by $${Math.round(cashNeeded - inputs.availableCash).toLocaleString("en-US")}.`);
  if (cashFlow === null) reasons.push("Listing cash flow is not disclosed, so debt coverage cannot be estimated.");
  else if (cashFlow >= requiredCashFlow) { score += 55; reasons.push("Reported cash flow appears to cover your income target and estimated debt service."); }
  else reasons.push("Reported cash flow may not cover your income target and estimated debt service.");
  return { score, status: score >= 75 ? "strong" as const : score >= 45 ? "review" as const : "weak" as const, reasons, cashNeeded, annualDebtService, requiredCashFlow };
}
