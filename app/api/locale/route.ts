import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const localeValue = request.nextUrl.searchParams.get("locale") ?? "";
  const locale = isLocale(localeValue) ? localeValue : "en";
  const requestedReturn = request.nextUrl.searchParams.get("return_to") ?? `/${locale}`;
  const returnTo = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//")
    ? requestedReturn
    : `/${locale}`;
  const response = NextResponse.redirect(new URL(returnTo, request.url));

  response.cookies.set("crestview_locale", locale, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const user = (await supabase.auth.getUser()).data.user;
      if (user) await supabase.from("profiles").update({ locale }).eq("id", user.id);
    } catch {
      // The browser preference still works if account sync is unavailable.
    }
  }

  return response;
}
