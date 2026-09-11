"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { parseEmployeeCsv, validDate } from "@/lib/workforce";

function finish(locale: string, notice: string): never {
  revalidatePath(`/${locale}/dashboard/workforce`);
  redirect(`/${locale}/dashboard/workforce?notice=${notice}`);
}
async function ctx(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (!isLocale(locale)) redirect("/en/dashboard/workforce");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return { locale, supabase, user };
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function createEmployee(formData: FormData) {
  const { locale, supabase, user } = await ctx(formData);
  const fullName = value(formData, "full_name"), email = value(formData, "email"), date = value(formData, "start_date");
  if (!fullName || fullName.length > 200 || !validDate(date) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) finish(locale, "invalid");
  const { error } = await supabase.from("employees").insert({
    user_id: user.id, full_name: fullName, email: email || null,
    position: value(formData, "position") || null, department: value(formData, "department") || null,
    manager_name: value(formData, "manager_name") || null, start_date: date || null,
    preferred_locale: value(formData, "preferred_locale") === "es" ? "es" : "en",
  });
  finish(locale, error ? (error.message.includes('Workforce') ? "capacity" : "failed") : "saved");
}
export async function addEmployeeRecord(formData: FormData) {
  const { locale, supabase, user } = await ctx(formData);
  const title = value(formData, "title"), employeeId = value(formData, "employee_id"), type = value(formData, "record_type"), date = value(formData, "expires_on"), hours = value(formData, "hours");
  if (!title || title.length > 500 || !["certification", "training", "pto", "document"].includes(type) || !validDate(date) || (hours && (!Number.isFinite(Number(hours)) || Number(hours) < 0))) finish(locale, "invalid");
  const { data: employee, error: ownershipError } = await supabase.from("employees").select("id").eq("id", employeeId).eq("user_id", user.id).maybeSingle();
  if (ownershipError || !employee) finish(locale, "failed");
  const { error } = await supabase.from("employee_records").insert({
    user_id: user.id, employee_id: employeeId, record_type: type, title,
    expires_on: date || null, hours: hours ? Number(hours) : null, status: type === "pto" ? "pending" : "active",
  });
  finish(locale, error ? "failed" : "saved");
}
export async function updateTimeOff(formData: FormData) {
  const { locale, supabase, user } = await ctx(formData);
  const status = value(formData, "status");
  if (!["approved", "rejected"].includes(status)) finish(locale, "invalid");
  const { data, error } = await supabase.from("employee_records").update({ status })
    .eq("id", value(formData, "record_id")).eq("user_id", user.id).eq("record_type", "pto").in("status", ["active", "pending"]).select("id");
  finish(locale, error || !data?.length ? "failed" : "saved");
}
export async function importEmployees(formData: FormData) {
  const { locale, supabase, user } = await ctx(formData);
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size || file.size > 750_000) finish(locale, "csv");
  let rows;
  try { rows = parseEmployeeCsv(await file.text()); } catch { finish(locale, "csv"); }
  const { error } = await supabase.from("employees").insert(rows.map(row => ({ ...row, user_id: user.id })));
  finish(locale, error ? (error.message.includes('Workforce') ? "capacity" : "failed") : "imported");
}
