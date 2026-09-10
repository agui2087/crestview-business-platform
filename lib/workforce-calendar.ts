export function calendarDays(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4))<1900 || Number(month.slice(0,4))>2200) throw new Error('Invalid month');
  const first=new Date(`${month}-01T00:00:00Z`);
  const days=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const cells:(string|null)[]=Array(first.getUTCDay()).fill(null);
  for(let day=1;day<=days;day++)cells.push(`${month}-${String(day).padStart(2,'0')}`);
  while(cells.length%7)cells.push(null);
  return cells;
}
export function leaveOnDay<T extends {kind:string;status:string;starts_on:string|null;ends_on:string|null}>(requests:T[],day:string) {
  return requests.filter(r=>r.kind==='leave'&&['pending','approved'].includes(r.status)&&r.starts_on&&r.ends_on&&r.starts_on<=day&&r.ends_on>=day);
}
