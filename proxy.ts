import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { createRequestId } from "@/lib/observability";

export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? createRequestId();
  const preferred = request.cookies.get("crestview_locale")?.value;
  const pathLocale = request.nextUrl.pathname.split("/")[1];
  if (
    (preferred === "en" || preferred === "es") &&
    (pathLocale === "en" || pathLocale === "es") &&
    preferred !== pathLocale
  ) {
    const url = request.nextUrl.clone();
    url.pathname = url.pathname.replace(/^\/(en|es)(?=\/|$)/, `/${preferred}`);
    const response = NextResponse.redirect(url);
    response.headers.set("x-request-id", requestId);
    return response;
  }
  const response = await updateSession(request);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
