"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  locale: z.enum(["en", "es"]),
});

export async function signIn(formData: FormData) {
  const input = credentialsSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) redirect(`/${input.locale}/sign-in?error=invalid`);
  redirect(`/${input.locale}/dashboard`);
}

export async function signUp(formData: FormData) {
  const input = credentialsSchema.parse(Object.fromEntries(formData));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (error) redirect(`/${input.locale}/sign-in?error=signup`);
  redirect(`/${input.locale}/sign-in?message=check-email`);
}
