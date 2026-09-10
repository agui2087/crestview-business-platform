"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validDate } from "@/lib/workforce";

export async function workforceOperation(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? "").trim();
  const locale = isLocale(get("locale")) ? get("locale") : "en";
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  const owner = get("owner") || user.id;
  const setup = ["business","location","department","placement"].includes(get("operation"));
  const path = `/${locale}/dashboard/workforce/${setup?"setup":"operations"}`;
  let result: { error: unknown; data?: unknown } = { error: true };
  const operation = get("operation");
  const validDates = ["start", "end", "due", "start_date"].every(key => validDate(get(key)));
  if (validDates) {
    if (operation === "placement") result = await db.rpc("workforce_set_placement", {p_employee:get("id"),p_version:Number(get("version")),p_location:get("location")||null,p_department:get("department_id")||null});
    if (operation === "business") result = await db.rpc("workforce_save_business", {p_owner:owner,p_version:Number(get("version")),p_name:get("name"),p_timezone:get("timezone")});
    if (operation === "location") result = await db.rpc("workforce_save_location", {p_owner:owner,p_id:get("id")||null,p_version:Number(get("version")),p_name:get("name"),p_country:get("country"),p_region:get("region"),p_timezone:get("timezone"),p_archived:get("archived")==="true"});
    if (operation === "department") result = await db.rpc("workforce_save_department", {p_owner:owner,p_id:get("id")||null,p_version:Number(get("version")),p_name:get("name"),p_archived:get("archived")==="true"});
    if (operation === "create" && get("full_name").length > 0 && get("full_name").length <= 200 && (!get("email") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email")))) result = await db.from("employees").insert({ user_id:owner,full_name:get("full_name"),email:get("email")||null,position:get("position")||null,department:get("department")||null,preferred_locale:locale });
    if (operation === "invite") result = await db.rpc("workforce_invite", { p_owner: owner, p_email: get("email"), p_role: get("role"), p_employee: get("employee") || null });
    if (operation === "accept" || operation === "revoke") result = await db.rpc("workforce_membership_decision", { p_id: get("id"), p_accept: operation === "accept" });
    if (operation === "edit" || operation === "archive" || operation === "restore") {
      const changes = operation === "edit" ? Object.fromEntries(["full_name","email","phone","position","department","manager_name","manager_user_id","start_date","employment_status","preferred_locale"].map(key => [key,get(key)])) : { archived: operation === "archive" };
      result = await db.rpc("workforce_update_employee", { p_id: get("employee"), p_version: Number(get("version")), p_changes: changes });
    }
    if (operation === "leave" || operation === "profile") result = await db.rpc("workforce_submit_request", {
      p_employee: get("employee"), p_kind: operation, p_title: operation === "profile" ? "Contact details update" : get("title"),
      p_start: get("start") || null, p_end: get("end") || null, p_leave_type: get("leave_type") || null,
      p_changes: operation === "profile" ? { email:get("email"),phone:get("phone"),preferred_locale:get("preferred_locale") } : {},
    });
    if (operation === "decide") result = await db.rpc("workforce_decide_request", { p_id:get("id"),p_status:get("status"),p_reason:get("reason") });
    if (operation === "task") result = await db.rpc("workforce_assign_task", { p_employee:get("employee"),p_category:get("category"),p_title:get("title"),p_assignee:get("assignee"),p_due:get("due") });
    if (operation === "reschedule") result = await db.rpc("workforce_reschedule_task", { p_id:get("id"),p_version:Number(get("version")),p_assignee:get("assignee"),p_due:get("due"),p_reason:get("reason") });
    if (operation === "template") result = await db.rpc("workforce_save_template", { p_owner:owner,p_id:get("id")||null,p_version:Number(get("version")),p_title:get("title"),p_category:get("category"),p_items:get("items").split(/\r?\n/).map(line=>line.trim()).filter(Boolean),p_archived:get("archived")==="true" });
    if (operation === "assign_template") result = await db.rpc("workforce_assign_template", { p_employee:get("employee"),p_template:get("id"),p_version:Number(get("version")),p_due:get("due"),p_assignee:get("assignee") });
    if (operation === "checklist") result = await db.rpc("workforce_start_checklist", { p_employee:get("employee"),p_category:get("category"),p_assignee:get("assignee"),p_due:get("due") });
    if (operation === "requirement") result = await db.rpc("workforce_add_requirement", { p_owner:owner,p_position:get("position"),p_title:get("title"),p_days:get("days")?Number(get("days")):null });
    if (operation === "assign_requirement") result = await db.rpc("workforce_assign_requirement", { p_employee:get("employee"),p_requirement:get("requirement"),p_assignee:get("assignee"),p_due:get("due") });
    if (operation === "complete" || operation === "verify") result = await db.rpc("workforce_finish_task", { p_id:get("id"),p_evidence:get("evidence"),p_verify:operation === "verify" });
  }
  revalidatePath(path);
  revalidatePath(`/${locale}/dashboard/workforce`);
  redirect(`${path}?owner=${encodeURIComponent(owner)}&notice=${result.error ? "failed" : "saved"}`);
}
