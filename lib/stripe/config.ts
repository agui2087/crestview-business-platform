import "server-only";

export const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;
export const STRIPE_INTEGRATION_IDENTIFIER = "crestview_qmrvxkda";

export const productCodes = [
  "crestview_pro",
  "single_listing",
  "broker_plan",
  "enhanced_visibility",
  "highest_visibility",
  "workforce",
] as const;

export type ProductCode = (typeof productCodes)[number];

type ProductDefinition = {
  envName: string;
  mode: "payment" | "subscription";
  entitlementDurationDays?: number;
};

export const productDefinitions: Record<ProductCode, ProductDefinition> = {
  crestview_pro: { envName: "STRIPE_PRICE_CRESTVIEW_PRO", mode: "subscription" },
  single_listing: { envName: "STRIPE_PRICE_SINGLE_LISTING", mode: "payment" },
  broker_plan: { envName: "STRIPE_PRICE_BROKER_PLAN", mode: "subscription" },
  enhanced_visibility: {
    envName: "STRIPE_PRICE_ENHANCED_VISIBILITY",
    mode: "payment",
    entitlementDurationDays: 30,
  },
  highest_visibility: {
    envName: "STRIPE_PRICE_HIGHEST_VISIBILITY",
    mode: "payment",
    entitlementDurationDays: 30,
  },
  workforce: { envName: "STRIPE_PRICE_WORKFORCE", mode: "subscription" },
};

export const workforceQuantities = [10, 25, 50, 100, 200, 300] as const;

export function isProductCode(value: string): value is ProductCode {
  return productCodes.includes(value as ProductCode);
}

export function getStripePriceId(productCode: ProductCode) {
  const definition = productDefinitions[productCode];
  const priceId = process.env[definition.envName]?.trim();
  if (!priceId?.startsWith("price_")) {
    throw new Error(`Stripe price is not configured for ${productCode}.`);
  }
  return priceId;
}

export function getProductCodeForPrice(priceId: string) {
  return productCodes.find((productCode) => {
    const configuredPrice = process.env[productDefinitions[productCode].envName]?.trim();
    return configuredPrice === priceId;
  });
}

export function parseCheckoutQuantity(productCode: ProductCode, rawQuantity: unknown) {
  if (productCode !== "workforce") return 1;
  const quantity = Number(rawQuantity);
  if (
    !Number.isInteger(quantity) ||
    !workforceQuantities.includes(quantity as (typeof workforceQuantities)[number])
  ) {
    throw new Error("Choose a supported workforce employee count.");
  }
  return quantity;
}
