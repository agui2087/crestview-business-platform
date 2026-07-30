import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const preferred = request.cookies.get("crestview_locale")?.value;
  const pathLocale = request.nextUrl.pathname.split("/")[1];
  if (
    (preferred === "en" || preferred === "es") &&
    (pathLocale === "en" || pathLocale === "es") &&
    preferred !== pathLocale
  ) {
    const url = request.nextUrl.clone();
    url.pathname = url.pathname.replace(/^\/(en|es)(?=\/|$)/, `/${preferred}`);
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
