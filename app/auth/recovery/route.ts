import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") === "es" ? "es" : "en";
  const code = request.nextUrl.searchParams.get("code");
  let valid = false;
  if (code && code.length <= 2048 && !request.nextUrl.searchParams.has("error")) {
    try {
      const client = await createSupabaseServerClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      valid = !error && Boolean(data.user && data.session);
    } catch { /* Invalid/expired links fail closed; never log the code. */ }
  }
  const response = NextResponse.redirect(new URL(`/${locale}/reset-password${valid ? "" : "?error=expired"}`, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
