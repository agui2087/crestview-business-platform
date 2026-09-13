import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { hasValidOrigin, redirectToSignIn, stripeReturnUrl } from "@/lib/stripe/request";
import { getStripe } from "@/lib/stripe/server";
import { getStripePriceId } from "@/lib/stripe/config";
import {editableWorkforceSubscription, matchesWorkforcePortal, workforcePortalConfiguration} from '@/lib/workforce-subscription-change';
import { createRequestId, logOperationalEvent, reportOperationalEvent } from "@/lib/observability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) ?? createRequestId();
  const formData = await request.formData();
  const localeValue = String(formData.get("locale") ?? "en");
  const locale = isLocale(localeValue) ? localeValue : "en";

  if (!hasValidOrigin(request)) {
    logOperationalEvent({ event: "security.origin_rejected", level: "warn", requestId, route: "/api/stripe/portal" });
    return NextResponse.redirect(stripeReturnUrl(request, locale, { billing_error: "request" }), 303);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirectToSignIn(request, locale);

    const { data: billingCustomer, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !billingCustomer?.stripe_customer_id) {
      return NextResponse.redirect(stripeReturnUrl(request, locale, { billing_error: "no_customer" }), 303);
    }

    const stripe = getStripe();
    if (formData.get('intent') === 'workforce_seats') {
      const priceId = getStripePriceId('workforce');
      const subscriptions = await stripe.subscriptions.list({customer: billingCustomer.stripe_customer_id, status: 'all', limit: 100, expand: ['data.latest_invoice']});
      // Ambiguous/truncated account histories require normal billing review, not a guessed subscription.
      if (subscriptions.has_more) throw new Error('workforce_subscription_unavailable');
      const subscription = editableWorkforceSubscription(subscriptions.data, billingCustomer.stripe_customer_id, priceId);
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active || price.type !== 'recurring' || price.recurring?.usage_type !== 'licensed' || price.billing_scheme !== 'per_unit') throw new Error('workforce_price_unavailable');
      const product = typeof price.product === 'string' ? price.product : price.product.id;
      let configuration: string | undefined;
      for await (const config of stripe.billingPortal.configurations.list({active: true, limit: 100})) {
        if (matchesWorkforcePortal(config, product, priceId)) { configuration = config.id; break; }
      }
      if (!configuration) {
        const config = await stripe.billingPortal.configurations.create(workforcePortalConfiguration(product, priceId), {idempotencyKey: `workforce-seats-v1-${priceId}`});
        if (!matchesWorkforcePortal(config, product, priceId)) throw new Error('workforce_portal_configuration');
        configuration = config.id;
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: billingCustomer.stripe_customer_id, configuration, locale,
        return_url: stripeReturnUrl(request, locale).toString(),
        flow_data: {type: 'subscription_update', subscription_update: {subscription: subscription.id}},
      });
      return NextResponse.redirect(session.url, 303);
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: billingCustomer.stripe_customer_id,
      return_url: stripeReturnUrl(request, locale).toString(),
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    await reportOperationalEvent({ event: "stripe.portal_failed", level: "error", requestId, route: "/api/stripe/portal", error });
    return NextResponse.redirect(stripeReturnUrl(request, locale, { billing_error: formData.get('intent') === 'workforce_seats' ? 'workforce_change' : 'portal' }), 303);
  }
}
