import "server-only";
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@/lib/stripe/config";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const apiKey = process.env.STRIPE_RESTRICTED_KEY?.trim();
  if (!apiKey?.startsWith("rk_") && !apiKey?.startsWith("sk_")) {
    throw new Error("Stripe server credentials are not configured.");
  }

  stripeClient ??= new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    appInfo: {
      name: "Crestview",
      version: "0.1.0",
      url: "https://crestview-business-platform.vercel.app",
    },
  });

  return stripeClient;
}
