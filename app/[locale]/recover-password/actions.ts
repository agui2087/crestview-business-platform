"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recoveryOrigin, validNewPassword } from "@/lib/password-recovery";

export async function requestPasswordRecovery(_previous: string, form: FormData): Promise<string> {
  const locale = form.get("locale") === "es" ? "es" : "en";
  const email = z.string().trim().email().max(254).safeParse(form.get("email"));
  if (!email.success) return "invalid-email";
  const origin = recoveryOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!origin) return "unavailable";
  try {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${origin}/auth/recovery?locale=${locale}`,
    });
    // Never reveal account existence or reflect provider messages/contact data.
    if (error?.status === 429) return "rate-limited";
    if (error) return "unavailable";
    return "sent";
  } catch { return "unavailable"; }
}

export async function completePasswordRecovery(_previous: string, form: FormData): Promise<string> {
  const locale = form.get("locale") === "es" ? "es" : "en";
  const password = form.get("password");
  if (!validNewPassword(password, form.get("confirmation"))) return "invalid-password";
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return "expired";
    const result = await client.auth.updateUser({ password: password as string });
    if (result.error) return "password-rejected";
    // End this recovery session. Provider password/session policies remain intact.
    const signedOut = await client.auth.signOut({ scope: "local" });
    if (signedOut.error) return "updated";
  } catch { return "unavailable"; }
  redirect(`/${locale}/sign-in?message=password-updated`);
}
