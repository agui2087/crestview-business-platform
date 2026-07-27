import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";

export async function getCrestviewUser(locale: Locale) {
  const authUser = await requireChatGPTUser(`/${locale}/dashboard`);
  if (authUser.source === "local") {
    return { ...authUser, locale };
  }
  if (authUser.source === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(`/${locale}/sign-in`);
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, locale, organization_name")
      .eq("user_id", user.id)
      .maybeSingle();
    return {
      ...authUser,
      displayName: profile?.display_name ?? authUser.displayName,
      organizationName: profile?.organization_name ?? "Crestview Holdings",
      locale: profile?.locale === "es" ? "es" : locale,
    };
  }

  redirect(`/${locale}/create-account`);
}
