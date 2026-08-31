import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasValidOrigin, redirectToSignIn, stripeReturnUrl } from "@/lib/stripe/request";
import { isLocale } from "@/lib/i18n";

export const runtime = "nodejs";

const BROKER_TRIAL_CODE_HASH = "e6b2d13b0d97e9256653e15473c1e03e34d433095ac95f53efd8086bebc3871e";
const BROKER_TRIAL_SOURCE = "broker-trial-code-v1";

function normalizedCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/[\s-]+/g, "").toUpperCase();
}

function validCode(value: string) {
  const supplied = Buffer.from(createHash("sha256").update(value).digest("hex"));
  const expected = Buffer.from(BROKER_TRIAL_CODE_HASH);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function trialExpiration() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.toISOString();
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const localeValue = String(formData.get("locale") ?? "en");
  const locale = isLocale(localeValue) ? localeValue : "en";
  const returnUrl = (status: string) => stripeReturnUrl(request, locale, { broker_code: status });

  if (!hasValidOrigin(request)) return NextResponse.redirect(returnUrl("request"), 303);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectToSignIn(request, locale);

  if (!validCode(normalizedCode(formData.get("broker_code")))) {
    return NextResponse.redirect(returnUrl("invalid"), 303);
  }

  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: existing }] = await Promise.all([
    admin.from("profiles").select("account_roles").eq("user_id", user.id).maybeSingle(),
    admin.from("billing_entitlements").select("active,expires_at,source_event_id").eq("user_id", user.id).eq("product_code", "broker_plan").maybeSingle(),
  ]);

  const roles = (profile?.account_roles as string[] | null) ?? [];
  if (!roles.includes("broker")) return NextResponse.redirect(returnUrl("role"), 303);
  if (existing) return NextResponse.redirect(returnUrl("used"), 303);

  const { error } = await admin.from("billing_entitlements").insert({
    user_id: user.id,
    product_code: "broker_plan",
    active: true,
    quantity: 1,
    expires_at: trialExpiration(),
    source_event_id: BROKER_TRIAL_SOURCE,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.redirect(returnUrl("used"), 303);
  return NextResponse.redirect(returnUrl("success"), 303);
}
