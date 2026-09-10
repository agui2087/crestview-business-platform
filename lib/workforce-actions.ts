type Employee={id:string;full_name:string;archived_at:string|null};
type Request={id:string;employee_id:string;kind:string;status:string;created_by:string;approver_id:string};
type Task={id:string;employee_id:string;title:string;status:string;due_on:string;completed_by:string|null;verified_at:string|null};
export type WorkforceNextAction={id:string;kind:'review_leave'|'review_profile'|'overdue_task'|'verify_task';employee:string;title:string;href:string};

/** Only call with RLS-filtered records; presentation eligibility mirrors RPC rules. */
export function workforceNextActions({employees,requests,tasks,userId,role,today}:{employees:Employee[];requests:Request[];tasks:Task[];userId:string;role:string;today:string}):WorkforceNextAction[] {
  if(!['owner','hr','manager'].includes(role))return [];
  const names=new Map(employees.filter(e=>!e.archived_at).map(e=>[e.id,e.full_name]));
  const actions:WorkforceNextAction[]=[];
  for(const r of requests) {
    if(!names.has(r.employee_id)||r.status!=='pending'||r.created_by===userId)continue;
    if(r.kind==='profile'&&role==='manager')continue;
    if(role==='manager'&&r.approver_id!==userId)continue;
    actions.push({id:r.id,kind:r.kind==='profile'?'review_profile':'review_leave',employee:names.get(r.employee_id)!,title:'',href:`#request-${r.id}`});
  }
  for(const t of tasks) {
    if(!names.has(t.employee_id))continue;
    if(t.status==='open'&&t.due_on<today)actions.push({id:t.id,kind:'overdue_task',employee:names.get(t.employee_id)!,title:t.title,href:`#task-${t.id}`});
    else if(t.status==='completed'&&!t.verified_at&&t.completed_by!==userId)actions.push({id:t.id,kind:'verify_task',employee:names.get(t.employee_id)!,title:t.title,href:`#task-${t.id}`});
  }
  return actions;
}
