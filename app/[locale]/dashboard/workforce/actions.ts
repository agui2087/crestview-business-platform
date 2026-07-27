"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";

async function ctx(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (!isLocale(locale)) redirect("/en/dashboard/workforce");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return { locale, supabase, user };
}

export async function createEmployee(formData: FormData) {
  const { locale, supabase, user } = await ctx(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName) await supabase.from("employees").insert({
    user_id: user.id, full_name: fullName,
    email: String(formData.get("email") ?? "") || null,
    position: String(formData.get("position") ?? "") || null,
    department: String(formData.get("department") ?? "") || null,
    manager_name: String(formData.get("manager_name") ?? "") || null,
    start_date: String(formData.get("start_date") ?? "") || null,
    preferred_locale: String(formData.get("preferred_locale")) === "es" ? "es" : "en",
  });
  revalidatePath(`/${locale}/dashboard/workforce`);
}

export async function addEmployeeRecord(formData: FormData) {
  const { locale, supabase, user } = await ctx(formData);
  const title = String(formData.get("title") ?? "").trim();
  if (title) await supabase.from("employee_records").insert({
    user_id: user.id, employee_id: String(formData.get("employee_id")),
    record_type: String(formData.get("record_type")), title,
    expires_on: String(formData.get("expires_on") ?? "") || null,
    hours: Number(formData.get("hours")) || null,
  });
  revalidatePath(`/${locale}/dashboard/workforce`);
}

export async function importEmployees(formData: FormData) {
  const { locale, supabase, user } = await ctx(formData);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size > 2_000_000) return;
  const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
  const rows = lines.slice(1, 501).map((line) => {
    const [full_name,email,position,department,manager_name,start_date,preferred_locale] = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    return { user_id:user.id, full_name, email:email||null, position:position||null, department:department||null, manager_name:manager_name||null, start_date:start_date||null, preferred_locale:preferred_locale === "es" ? "es" : "en" };
  }).filter((row) => row.full_name);
  if (rows.length) await supabase.from("employees").insert(rows);
  revalidatePath(`/${locale}/dashboard/workforce`);
}
