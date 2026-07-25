import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import type { Locale } from "@/lib/i18n";

export async function getCrestviewUser(locale: Locale) {
  const authUser = await requireChatGPTUser(`/${locale}/dashboard`);
  const [profile] = await (await getDb())
    .select()
    .from(profiles)
    .where(eq(profiles.email, authUser.email))
    .limit(1);

  if (!profile) redirect(`/${locale}/create-account`);
  return { ...authUser, displayName: profile.displayName, locale: profile.locale };
}
