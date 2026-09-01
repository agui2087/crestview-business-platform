import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasValidOrigin, redirectToSignIn, stripeReturnUrl } from "@/lib/stripe/request";
import { isLocale } from "@/lib/i18n";

export const runtime = "nodejs";

const BROKER_TRIAL_CODES = [
  { sponsor: "legacy", hash: "e6b2d13b0d97e9256653e15473c1e03e34d433095ac95f53efd8086bebc3871e" },
  { sponsor: "union-bay-group", hash: "79631775317c18a80b639194c9b17d608bd851e080237c8324e7de718a576d74" },
  { sponsor: "transition360", hash: "5b82b6c5cc5e25818a340297dc5e3d7a0e600e71f6dfc8f2f914695fa799c939" },
  { sponsor: "washington-business-brokers", hash: "59ec9e78c196b1255be6d18a444e45a2768803afe160cad7b69174cd8a64d58f" },
  { sponsor: "the-quincy-group", hash: "b631700321878fe77e893047737df9dfc0179745da507a134e6fe77fec8264f2" },
  { sponsor: "iba", hash: "51df7e610bd85878df66e11bc4b3d64bf6018dfbc152e8279ef7e7cd8796b925" },
  { sponsor: "pnw-business-brokers", hash: "bd9f4484b9dc4fb2fc007fe5089f3c998ca7ed37b8cf1bea7c8df5f675f8f8b9" },
  { sponsor: "rjc", hash: "949307d703fa1a5438224b9369a22504c721d213fee4c95afc96b54206a65a7c" },
  { sponsor: "businesses-for-sale-portland", hash: "9c72dcef225fefecb0f5735cba31c818d370a6450972862810e62c893bc66c38" },
  { sponsor: "business-brokers-oregon", hash: "016c9356e6bdd7b3328fe69674626e70415de86396a71108087cf06453cd9766" },
  { sponsor: "arx", hash: "69e9f41db1e3c8380fbcc3985bc95bc0e1019312c656f6d24dbed25b9ae0770d" },
  { sponsor: "sierra-bay-partners", hash: "472cc0bb4dc5b536c49e9862cfc0c74e32e48c4dbc54cc024933093dce8e996b" },
  { sponsor: "the-bay-advisors", hash: "03f2ebf55314cc455407f33a11cd23acbde204cb70439c7a03f8fcf0584a84a6" },
  { sponsor: "rlc", hash: "d63c878d4aef4eb73839e918a5b9f5c2fe92e1d879fcc989ea5512138ccb325d" },
  { sponsor: "zoom", hash: "dd4f4934bdd7d641cdb4abf114eaea14f60fd211f8cb1c91c45ef193517c181a" },
  { sponsor: "liberty", hash: "4661384520223d10c7664ff125b78f1757ac052ea79cb3149fa9b04f55fddfb6" },
  { sponsor: "test", hash: "72997aacff17e4dd7856158764ed3fb5b4a79762e792b6538b7f69e5d9b2a690" },
] as const;

function normalizedCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/[\s-]+/g, "").toUpperCase();
}

function matchedCode(value: string) {
  const supplied = Buffer.from(createHash("sha256").update(value).digest("hex"));
  return BROKER_TRIAL_CODES.find(({ hash }) => {
    const expected = Buffer.from(hash);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
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

  const trialCode = matchedCode(normalizedCode(formData.get("broker_code")));
  if (!trialCode) {
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
    source_event_id: `broker-trial-code-v2:${trialCode.sponsor}`,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.redirect(returnUrl("used"), 303);
  return NextResponse.redirect(returnUrl("success"), 303);
}
