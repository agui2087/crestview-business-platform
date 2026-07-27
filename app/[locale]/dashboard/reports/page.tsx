import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const es = locale === "es";
  let stages: Record<string,number> = {};
  let total = 0; let complete = 0; let tasks = 0; let verified = 0;
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [{ data: deals }, { count: taskCount }, { count: verifiedCount }] = await Promise.all([
        supabase.from("saved_opportunities").select("stage").eq("user_id", user.id),
        supabase.from("deal_tasks").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("status","complete"),
        supabase.from("diligence_items").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("status","verified"),
      ]);
      total = deals?.length ?? 0; tasks = taskCount ?? 0; verified = verifiedCount ?? 0;
      stages = (deals ?? []).reduce((map,item) => ({...map,[item.stage]:(map[item.stage] ?? 0)+1}),{} as Record<string,number>);
      complete = stages.complete ?? 0;
    }
  }
  const max = Math.max(1,...Object.values(stages));
  return <PlatformShell locale={locale} active="reports"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Rendimiento" : "Performance"} title={es ? "Informes de adquisición" : "Acquisition reports"} body={es ? "Comprende el avance de tu proceso y el trabajo completado." : "Understand pipeline progress and completed acquisition work."}/>
    <div className="metric-grid">{[[es?"Oportunidades":"Opportunities",total],[es?"Compras completadas":"Completed acquisitions",complete],[es?"Tareas completadas":"Completed tasks",tasks],[es?"Elementos verificados":"Verified diligence",verified]].map(([label,value])=><article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <section className="panel report-panel"><div className="panel__header"><h2>{es ? "Distribución del proceso" : "Pipeline distribution"}</h2></div>
      {Object.keys(stages).length ? Object.entries(stages).map(([stage,count])=><div className="report-bar" key={stage}><span>{stage}</span><div><i style={{width:`${Math.max(6,(count/max)*100)}%`}}/></div><strong>{count}</strong></div>) : <p>{es ? "Los informes aparecerán cuando guardes oportunidades." : "Reports will populate as you save opportunities."}</p>}
    </section>
  </div></PlatformShell>;
}
