import { workforceAnalytics } from "@/lib/workforce-analytics";

export function WorkforceAnalytics({metrics,locale,limited}:{metrics:ReturnType<typeof workforceAnalytics>;locale:string;limited:boolean}) {
  const t=(en:string,es:string)=>locale==="es"?es:en;
  return <section className="panel"><h2>{t("Workforce analytics","Análisis de personal")}</h2>
    <p>{t("A snapshot of the records you are authorized to see. Archived and terminated profiles are excluded. Task completion is not a measure of employee productivity or legal compliance.","Resumen de los registros que puedes consultar. Excluye perfiles archivados y terminados. Completar tareas no mide productividad ni cumplimiento legal.")}</p>
    {limited&&<p role="status">{t("This snapshot may be partial because a 500-record display limit was reached. Do not treat these figures as company-wide totals.","Este resumen puede ser parcial por el límite de 500 registros. No representa necesariamente totales de la empresa.")}</p>}
    <dl className="wf-analytics-grid">{[
      [t("Current headcount","Personal actual"),metrics.headcount],
      [t("Profiles marked on leave","Perfiles en ausencia"),metrics.onLeave],
      [t("Task completion","Finalización de tareas"),metrics.completionRate===null?"—":`${metrics.completionRate}% (${metrics.completed}/${metrics.tasks})`],
      [t("Overdue open tasks","Tareas abiertas vencidas"),metrics.overdue],
      [t("Completed, awaiting verification","Completadas, sin verificar"),metrics.awaitingVerification],
      [t("Verified training assignments","Asignaciones de capacitación verificadas"),`${metrics.verifiedTraining}/${metrics.training}`],
      [t("Pending leave requests","Solicitudes de ausencia pendientes"),metrics.pendingLeave],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h3>{t("Staffing by department","Personal por departamento")}</h3>
    {!metrics.departments.length?<p>{t("Add employee profiles to populate this view.","Agrega empleados para completar esta vista.")}</p>:<ul>{metrics.departments.map(d=><li key={d.name}>{d.name||t("Not assigned","Sin asignar")}: {d.count}</li>)}</ul>}
    <p>{t("Payroll costs, turnover rates and leave balances are not calculated without the required source data and approved policies.","No se calculan costos de nómina, rotación ni saldos de ausencia sin datos de origen y políticas aprobadas.")}</p>
  </section>;
}
