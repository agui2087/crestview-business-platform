import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { opportunities } from "@/lib/demo-data";
import {resolveOpportunities} from '@/lib/opportunity-resolver';
import { isLocale } from "@/lib/i18n";
import { platformCopy } from "@/lib/platform-copy";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createTask, toggleTask } from "./actions";

type DealTask = { id: string; title: string; opportunity_key: string | null; due_date: string | null; priority: string; status: string };

export default async function TasksPage({ params,searchParams }: { params: Promise<{ locale: string }>;searchParams:Promise<{saved?:string;error?:string}> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = platformCopy(locale);
  const es = locale === "es";
  let tasks: DealTask[] = [];
  let choices=opportunities.map(item=>({id:item.id,title:item.title}));
  let loadFailed=false;
  const query=await searchParams;
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data,error } = await supabase.from("deal_tasks").select("id,title,opportunity_key,due_date,priority,status").eq("user_id", user.id).order("status").order("due_date");
      loadFailed=Boolean(error);
      tasks = (data ?? []) as DealTask[];
      const [saved,inquiries]=await Promise.all([
        supabase.from('saved_opportunities').select('opportunity_key').eq('user_id',user.id).order('updated_at',{ascending:false}).limit(500),
        supabase.from('deal_inquiries').select('id').eq('buyer_id',user.id).order('updated_at',{ascending:false}).limit(500),
      ]);
      if(saved.error||inquiries.error)loadFailed=true;
      const keys=[...new Set([...(saved.data??[]).map(row=>row.opportunity_key),...(inquiries.data??[]).map(row=>`deal-${row.id}`),...tasks.map(row=>row.opportunity_key).filter((key):key is string=>Boolean(key))])];
      const resolved=await resolveOpportunities(keys,locale);
      choices=[...resolved.values()].map(item=>({id:item.id,title:item.title}));
    }
  }
  return <PlatformShell locale={locale} active="tasks"><div className="dashboard-content">
    <PageHeading eyebrow={text.tasks.eyebrow} title={text.tasks.title} body={text.tasks.body} action={<Link className="button button--light" href={`/api/export/tasks?locale=${locale}`}>{es ? "Exportar tareas" : "Export tasks"}</Link>} />
    {query.saved&&<p role="status">{es?'Tarea guardada.':'Task saved.'}</p>}
    {query.error&&<p role="alert">{es?'No se pudo guardar. Revisa los datos y tu acceso, e inténtalo de nuevo.':'Could not save. Check the details and your access, then try again.'}</p>}
    {loadFailed&&<p role="alert">{es?'No se pudieron cargar todos los datos. Actualiza antes de continuar.':'Some task information could not be loaded. Refresh before continuing.'}</p>}
    <form className="task-create" action={createTask}>
      <input type="hidden" name="locale" value={locale} />
      <label>{text.tasks.task}<input required maxLength={300} name="title" placeholder={es ? "Solicitar tres años de declaraciones de impuestos" : "Request three years of tax returns"} /></label>
      <label>{text.tasks.opportunity}<select name="opportunity_key"><option value="">{es ? "Tarea general" : "General task"}</option>{choices.map((item)=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>{text.tasks.due}<input type="date" name="due_date" /></label>
      <label>{text.tasks.priority}<select name="priority"><option value="medium">{es ? "Media" : "Medium"}</option><option value="high">{es ? "Alta" : "High"}</option><option value="low">{es ? "Baja" : "Low"}</option></select></label>
      <button className="button button--primary" type="submit">{text.tasks.add}</button>
    </form>
    <section className="task-list">
      {tasks.map((task) => <article className={task.status === "complete" ? "is-complete" : ""} key={task.id}>
        <div><span>{es?({high:'Alta',medium:'Media',low:'Baja'}[task.priority]??task.priority):task.priority} {es ? "prioridad" : "priority"}</span><strong>{task.title}</strong><small>{task.opportunity_key ? choices.find(item=>item.id===task.opportunity_key)?.title??(es?'Oportunidad no disponible':'Opportunity unavailable') : text.common.general} · {task.due_date ?? text.common.noDueDate}</small></div>
        <form action={toggleTask}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={task.id}/><input type="hidden" name="status" value={task.status === "complete" ? "open" : "complete"}/><button type="submit">{task.status === "complete" ? (es ? "Reabrir" : "Reopen") : (es ? "Completar" : "Complete")}</button></form>
      </article>)}
      {!tasks.length && !loadFailed && <div className="empty-state"><h2>{text.tasks.empty}</h2><p>{text.tasks.emptyBody}</p></div>}
    </section>
  </div></PlatformShell>;
}
