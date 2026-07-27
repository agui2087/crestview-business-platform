import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { opportunities, getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createTask, toggleTask } from "./actions";

type DealTask = { id: string; title: string; opportunity_key: string | null; due_date: string | null; priority: string; status: string };

export default async function TasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
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
    <PageHeading eyebrow="Work queue" title="Tasks" body="Create real tasks, connect them to opportunities, and track due dates and priority." />
    <form className="task-create" action={createTask}>
      <input type="hidden" name="locale" value={locale} />
      <label>Task<input required name="title" placeholder="Request three years of tax returns" /></label>
      <label>Opportunity<select name="opportunity_key"><option value="">General task</option>{opportunities.map((item)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Due date<input type="date" name="due_date" /></label>
      <label>Priority<select name="priority"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></label>
      <button className="button button--primary" type="submit">Add task</button>
    </form>
    <section className="task-list">
      {tasks.map((task) => <article className={task.status === "complete" ? "is-complete" : ""} key={task.id}>
        <div><span>{task.priority} priority</span><strong>{task.title}</strong><small>{task.opportunity_key ? getOpportunity(task.opportunity_key)?.title : "General"} · {task.due_date ?? "No due date"}</small></div>
        <form action={toggleTask}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={task.id}/><input type="hidden" name="status" value={task.status === "complete" ? "open" : "complete"}/><button type="submit">{task.status === "complete" ? "Reopen" : "Complete"}</button></form>
      </article>)}
      {!tasks.length && <div className="empty-state"><h2>No tasks yet</h2><p>Create the first task above. It will be stored with your account.</p></div>}
    </section>
  </div></PlatformShell>;
}
