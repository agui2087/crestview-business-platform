import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const url = new URL(request.url);
  const requestedReturn = url.searchParams.get("return_to") ?? "/en";
  const returnTo = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "/en";
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set("crestview_local_user", "", { path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}
