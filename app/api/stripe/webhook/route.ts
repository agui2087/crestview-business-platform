import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getProductCodeForPrice,
  productDefinitions,
  type ProductCode,
} from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function unixTimeToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function verifiedUserId(value: string | null | undefined) {
  return value && uuidPattern.test(value) ? value : null;
}

async function applyBillingEvent(
  event: Stripe.Event,
  values: {
    userId?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    productCode?: ProductCode | null;
    priceId?: string | null;
    status?: string | null;
    quantity?: number;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    entitlementActive?: boolean;
    entitlementOperation?: "none" | "set" | "increment";
    entitlementExpiresAt?: string | null;
  } = {},
) {
  const { error } = await createSupabaseAdminClient().rpc("apply_stripe_billing_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_user_id: values.userId ?? null,
    p_customer_id: values.customerId ?? null,
    p_subscription_id: values.subscriptionId ?? null,
    p_product_code: values.productCode ?? null,
    p_price_id: values.priceId ?? null,
    p_status: values.status ?? null,
    p_quantity: values.quantity ?? 1,
    p_current_period_end: values.currentPeriodEnd ?? null,
    p_cancel_at_period_end: values.cancelAtPeriodEnd ?? false,
    p_entitlement_active: values.entitlementActive ?? false,
    p_entitlement_operation: values.entitlementOperation ?? "none",
    p_entitlement_expires_at: values.entitlementExpiresAt ?? null,
  });
  if (error) throw error;
}

async function processPaidCheckout(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    await applyBillingEvent(event);
    return;
  }

  const userId = verifiedUserId(
    session.client_reference_id ?? session.metadata?.crestview_user_id,
  );
  const customerId = stripeId(session.customer);
  const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 2 });
  const lineItem = lineItems.data[0];
  const priceId = lineItem?.price?.id ?? null;
  const productCode = priceId ? getProductCodeForPrice(priceId) : undefined;
  if (
    !userId ||
    !customerId ||
    !priceId ||
    !productCode ||
    productDefinitions[productCode].mode !== "payment" ||
    session.metadata?.product_code !== productCode
  ) {
    throw new Error("Paid Checkout metadata did not match the server allowlist.");
  }

  const durationDays = productDefinitions[productCode].entitlementDurationDays;
  const entitlementExpiresAt = durationDays
    ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
    : null;

  await applyBillingEvent(event, {
    userId,
    customerId,
    productCode,
    priceId,
    quantity: lineItem.quantity ?? 1,
    entitlementActive: true,
    entitlementOperation: "increment",
    entitlementExpiresAt,
  });
}

async function processSubscription(event: Stripe.Event, subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const productCode = priceId ? getProductCodeForPrice(priceId) : undefined;
  const userId = verifiedUserId(subscription.metadata.crestview_user_id);
  const customerId = stripeId(subscription.customer);
  if (
    !item ||
    !priceId ||
    !productCode ||
    !userId ||
    !customerId ||
    productDefinitions[productCode].mode !== "subscription" ||
    subscription.metadata.product_code !== productCode
  ) {
    throw new Error("Subscription metadata did not match the server allowlist.");
  }

  const entitlementActive = ["active", "trialing", "past_due"].includes(subscription.status);
  await applyBillingEvent(event, {
    userId,
    customerId,
    subscriptionId: subscription.id,
    productCode,
    priceId,
    status: subscription.status,
    quantity: item.quantity ?? 1,
    currentPeriodEnd: unixTimeToIso(item.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    entitlementActive,
    entitlementOperation: "set",
    entitlementExpiresAt: entitlementActive ? unixTimeToIso(item.current_period_end) : null,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await processPaidCheckout(event, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await processSubscription(event, event.data.object);
        break;
      default:
        await applyBillingEvent(event);
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
