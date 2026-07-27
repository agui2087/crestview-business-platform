"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";

async function context(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (!isLocale(locale)) redirect("/en/dashboard/tasks");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return { locale, supabase, user };
}

export async function createTask(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const title = String(formData.get("title") ?? "").trim();
  if (title) await supabase.from("deal_tasks").insert({
    user_id: user.id, title,
    opportunity_key: String(formData.get("opportunity_key") ?? "") || null,
    due_date: String(formData.get("due_date") ?? "") || null,
    priority: String(formData.get("priority") ?? "medium"),
  });
  revalidatePath(`/${locale}/dashboard/tasks`);
}

export async function toggleTask(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await supabase.from("deal_tasks").update({
    status: String(formData.get("status")) === "complete" ? "complete" : "open",
    updated_at: new Date().toISOString(),
  }).eq("id", String(formData.get("id"))).eq("user_id", user.id);
  revalidatePath(`/${locale}/dashboard/tasks`);
}
