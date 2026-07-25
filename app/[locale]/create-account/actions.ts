"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(["en", "es"]),
});

export async function createProfile(formData: FormData) {
  const input = profileSchema.parse(Object.fromEntries(formData));
  const user = await requireChatGPTUser(`/${input.locale}/create-account`);
  const now = new Date().toISOString();
  await (await getDb())
    .insert(profiles)
    .values({
      email: user.email,
      displayName: input.displayName,
      locale: input.locale,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: profiles.email,
      set: { displayName: input.displayName, locale: input.locale, updatedAt: now },
    });
  redirect(`/${input.locale}/dashboard`);
}
