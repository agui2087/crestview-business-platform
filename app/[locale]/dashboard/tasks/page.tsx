import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { platformTasks } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

export default async function TasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <PlatformShell locale={locale} active="tasks"><div className="dashboard-content">
    <PageHeading eyebrow="Work queue" title="Tasks" body="Keep diligence requests, broker follow-ups, and internal reviews moving." action={<button className="button button--primary" disabled>New task</button>} />
    <section className="table-panel"><div className="table-head"><span>Task</span><span>Opportunity</span><span>Due</span><span>Status</span></div>{platformTasks.map((task) => <div className="table-row" key={task.title}><strong>{task.title}</strong><span>{task.deal}</span><span>{task.due}</span><span className="stage">{task.status}</span></div>)}</section>
  </div></PlatformShell>;
}
