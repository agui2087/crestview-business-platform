import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
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

    const session = await getStripe().billingPortal.sessions.create({
      customer: billingCustomer.stripe_customer_id,
      return_url: stripeReturnUrl(request, locale).toString(),
    });
    return NextResponse.redirect(session.url, 303);
  } catch {
    return NextResponse.redirect(stripeReturnUrl(request, locale, { billing_error: "portal" }), 303);
  }
}
