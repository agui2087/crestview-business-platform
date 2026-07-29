import "server-only";
import { NextResponse } from "next/server";
import type { Locale } from "@/lib/i18n";

export function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export function stripeReturnUrl(
  request: Request,
  locale: Locale,
  query?: Record<string, string>,
) {
  const url = new URL(`/${locale}/pricing`, request.url);
  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

export function redirectToSignIn(request: Request, locale: Locale) {
  const url = new URL(`/${locale}/sign-in`, request.url);
  url.searchParams.set("return_to", `/${locale}/pricing`);
  return NextResponse.redirect(url, 303);
}
