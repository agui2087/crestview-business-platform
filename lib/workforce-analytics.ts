type Employee = {id:string;department:string|null;employment_status:string;archived_at:string|null};
type Task = {employee_id:string;status:string;due_on:string;verified_at:string|null;category:string};
type Request = {employee_id:string;kind:string;status:string};

/** Descriptive metrics only: no compensation, entitlement or productivity inference. */
export function workforceAnalytics(employees:Employee[],tasks:Task[],requests:Request[],today:string) {
  const current=employees.filter(e=>!e.archived_at&&e.employment_status!=="terminated");
  const ids=new Set(current.map(e=>e.id));
  const applicable=tasks.filter(t=>ids.has(t.employee_id));
  const completed=applicable.filter(t=>t.status==="completed");
  const training=applicable.filter(t=>t.category==="training"||t.category==="renewal");
  const departments=new Map<string,number>();
  for(const e of current) {const key=e.department?.trim()||"";departments.set(key,(departments.get(key)??0)+1);}
  return {
    headcount:current.length,
    onLeave:current.filter(e=>e.employment_status==="leave").length,
    departments:Array.from(departments,([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),
    tasks:applicable.length,completed:completed.length,
    completionRate:applicable.length?Math.round(completed.length/applicable.length*100):null,
    overdue:applicable.filter(t=>t.status==="open"&&t.due_on<today).length,
    awaitingVerification:completed.filter(t=>!t.verified_at).length,
    training:training.length,verifiedTraining:training.filter(t=>t.status==="completed"&&t.verified_at).length,
    pendingLeave:requests.filter(r=>ids.has(r.employee_id)&&r.kind==="leave"&&r.status==="pending").length,
  };
}
