type Catalog={id:string;archived:boolean};
type Placement={employee_id:string;location_id:string|null;department_id:string|null};
export function workforceReadiness(input:{businessConfigured:boolean;locations:Catalog[];departments:Catalog[];employees:{id:string}[];placements:Placement[]}) {
  const limited=[input.locations,input.departments,input.employees,input.placements].some(rows=>rows.length>=500);
  const locations=new Set(input.locations.filter(x=>!x.archived).map(x=>x.id));
  const departments=new Set(input.departments.filter(x=>!x.archived).map(x=>x.id));
  const placements=new Map(input.placements.map(p=>[p.employee_id,p]));
  const missing=input.employees.filter(e=>{const p=placements.get(e.id);return !p||!p.location_id||!p.department_id||!locations.has(p.location_id)||!departments.has(p.department_id);}).length;
  return {limited,businessConfigured:input.businessConfigured,activeLocations:locations.size,activeDepartments:departments.size,employees:input.employees.length,
    // A truncated catalog can conceal an existing assignment; don't label it missing.
    assignmentsToReview:limited?null:missing};
}
