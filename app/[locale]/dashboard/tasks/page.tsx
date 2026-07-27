import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { opportunities, getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { platformCopy } from "@/lib/platform-copy";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createTask, toggleTask } from "./actions";

type DealTask = { id: string; title: string; opportunity_key: string | null; due_date: string | null; priority: string; status: string };

export default async function TasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = platformCopy(locale);
  const es = locale === "es";
  let tasks: DealTask[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("deal_tasks").select("id,title,opportunity_key,due_date,priority,status").eq("user_id", user.id).order("status").order("due_date");
      tasks = (data ?? []) as DealTask[];
    }
  }
  return <PlatformShell locale={locale} active="tasks"><div className="dashboard-content">
    <PageHeading eyebrow={text.tasks.eyebrow} title={text.tasks.title} body={text.tasks.body} />
    <form className="task-create" action={createTask}>
      <input type="hidden" name="locale" value={locale} />
      <label>{text.tasks.task}<input required name="title" placeholder={es ? "Solicitar tres años de declaraciones de impuestos" : "Request three years of tax returns"} /></label>
      <label>{text.tasks.opportunity}<select name="opportunity_key"><option value="">{es ? "Tarea general" : "General task"}</option>{opportunities.map((item)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>{text.tasks.due}<input type="date" name="due_date" /></label>
      <label>{text.tasks.priority}<select name="priority"><option value="medium">{es ? "Media" : "Medium"}</option><option value="high">{es ? "Alta" : "High"}</option><option value="low">{es ? "Baja" : "Low"}</option></select></label>
      <button className="button button--primary" type="submit">{text.tasks.add}</button>
    </form>
    <section className="task-list">
      {tasks.map((task) => <article className={task.status === "complete" ? "is-complete" : ""} key={task.id}>
        <div><span>{task.priority} {es ? "prioridad" : "priority"}</span><strong>{task.title}</strong><small>{task.opportunity_key ? getOpportunity(task.opportunity_key)?.title : text.common.general} · {task.due_date ?? text.common.noDueDate}</small></div>
        <form action={toggleTask}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={task.id}/><input type="hidden" name="status" value={task.status === "complete" ? "open" : "complete"}/><button type="submit">{task.status === "complete" ? (es ? "Reabrir" : "Reopen") : (es ? "Completar" : "Complete")}</button></form>
      </article>)}
      {!tasks.length && <div className="empty-state"><h2>{text.tasks.empty}</h2><p>{text.tasks.emptyBody}</p></div>}
    </section>
  </div></PlatformShell>;
}
