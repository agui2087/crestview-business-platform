import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import {
  getStripePriceId,
  isProductCode,
  parseCheckoutQuantity,
  productDefinitions,
  STRIPE_INTEGRATION_IDENTIFIER,
} from "@/lib/stripe/config";
import { hasValidOrigin, redirectToSignIn, stripeReturnUrl } from "@/lib/stripe/request";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const localeValue = String(formData.get("locale") ?? "en");
  const locale = isLocale(localeValue) ? localeValue : "en";

  if (!hasValidOrigin(request)) {
    return NextResponse.redirect(stripeReturnUrl(request, locale, { billing_error: "request" }), 303);
  }

  const productCodeValue = String(formData.get("product_code") ?? "");
  if (!isProductCode(productCodeValue)) {
    return NextResponse.redirect(stripeReturnUrl(request, locale, { billing_error: "product" }), 303);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return redirectToSignIn(request, locale);

    const productCode = productCodeValue;
    const definition = productDefinitions[productCode];
    const priceId = getStripePriceId(productCode);
    const quantity = parseCheckoutQuantity(productCode, formData.get("quantity"));
    const admin = createSupabaseAdminClient();
    const stripe = getStripe();

    const { data: billingCustomer } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId = billingCustomer?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          name: String(user.user_metadata?.display_name ?? "").trim() || undefined,
          metadata: { crestview_user_id: user.id },
        },
        { idempotencyKey: `crestview-customer-${user.id}` },
      );
      stripeCustomerId = customer.id;
      const { error } = await admin.from("billing_customers").upsert({
        user_id: user.id,
        stripe_customer_id: customer.id,
        email: user.email,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
    }

    const metadata = {
      crestview_user_id: user.id,
      product_code: productCode,
      price_id: priceId,
      locale,
      quantity: String(quantity),
    };
    const successUrl = stripeReturnUrl(request, locale, { checkout: "success" }).toString();
    const cancelUrl = stripeReturnUrl(request, locale, { checkout: "canceled" }).toString();

    const session = await stripe.checkout.sessions.create(
      {
        mode: definition.mode,
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity }],
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: user.id,
        metadata,
        integration_identifier: STRIPE_INTEGRATION_IDENTIFIER,
        ...(definition.mode === "subscription"
          ? { subscription_data: { metadata } }
          : { payment_intent_data: { metadata } }),
      },
      {
        idempotencyKey: createHash("sha256")
          .update(`${user.id}:${productCode}:${quantity}:${Math.floor(Date.now() / 30_000)}`)
          .digest("hex"),
      },
    );

    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return NextResponse.redirect(session.url, 303);
  } catch {
    return NextResponse.redirect(stripeReturnUrl(request, locale, { billing_error: "checkout" }), 303);
  }
}
