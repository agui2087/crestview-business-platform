"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logOperationalEvent, reportOperationalEvent } from "@/lib/observability";
import { authReturnPath } from "@/lib/auth-return-path";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(80).optional(),
  accountRole: z.enum(["buyer", "broker", "advisor"]).optional(),
  locale: z.enum(["en", "es"]),
});

export async function signIn(formData: FormData) {
  const locale = formData.get("locale") === "es" ? "es" : "en";
  const returnTo = authReturnPath(formData.get("return_to"), locale);
  const failurePath = `/${locale}/sign-in?error=invalid&return_to=${encodeURIComponent(returnTo)}`;
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    logOperationalEvent({ event: "auth.sign_in_validation_failed", level: "warn", route: "/[locale]/sign-in" });
    redirect(failurePath);
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) {
    const providerFailure = !error.status || error.status >= 500;
    await reportOperationalEvent({ event: providerFailure ? "auth.provider_failed" : "auth.sign_in_rejected", level: providerFailure ? "error" : "warn", route: "/[locale]/sign-in", details: { providerStatus: error.status, providerCode: error.code } });
    redirect(failurePath);
  }
  redirect(returnTo);
}

export async function signUp(formData: FormData) {
  const locale = formData.get("locale") === "es" ? "es" : "en";
  const returnTo = authReturnPath(formData.get("return_to"), locale);
  const failurePath = `/${locale}/sign-in?error=signup&return_to=${encodeURIComponent(returnTo)}`;
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    logOperationalEvent({ event: "auth.sign_up_validation_failed", level: "warn", route: "/[locale]/sign-in" });
    redirect(failurePath);
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        display_name: input.displayName,
        locale: input.locale,
        account_roles: [input.accountRole ?? "buyer"],
        primary_role: input.accountRole ?? "buyer",
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/${input.locale}/dashboard`,
    },
  });
  if (error) {
    await reportOperationalEvent({ event: "auth.sign_up_failed", level: error.status && error.status < 500 ? "warn" : "error", route: "/[locale]/sign-in", details: { providerStatus: error.status, providerCode: error.code } });
    redirect(failurePath);
  }
  if (data.session) redirect(returnTo);
  redirect(`/${input.locale}/sign-in?message=check-email&return_to=${encodeURIComponent(returnTo)}`);
}
