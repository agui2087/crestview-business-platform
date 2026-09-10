/** Pure arithmetic only. Callers must supply authorized, complete, reviewed data.
 * Nothing here infers a statutory entitlement or writes a balance. Units are minutes.
 */
export type LeaveSchedule={startsOn:string;endsOn:string|null;dailyMinutes:number[];cancelled?:boolean};
export type LeavePolicyPeriod={startsOn:string;endsOn:string|null;reviewed:boolean;excludeHolidays:boolean};
type Result<T>={ok:true;value:T}|{ok:false;reason:string};
const dayMs=86_400_000;
function day(value:string):number|null {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const n=Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2200-12-31'?n:null;
}
function validPeriod(p:{startsOn:string;endsOn:string|null}) {
  return day(p.startsOn)!==null&&(p.endsOn===null||(day(p.endsOn)!==null&&p.endsOn>=p.startsOn));
}
function covers(p:{startsOn:string;endsOn:string|null},date:string) {return p.startsOn<=date&&(p.endsOn===null||p.endsOn>=date);}
const nonnegative=(n:number)=>Number.isSafeInteger(n)&&n>=0;

export function plannedLeaveMinutes(input:{start:string;end:string;schedules:LeaveSchedule[];policies:LeavePolicyPeriod[];holidays:string[]|null}):Result<{minutes:number;days:{date:string;minutes:number;holidayExcluded:boolean}[]}> {
  const start=day(input.start),end=day(input.end);
  if(start===null||end===null||end<start||end-start>365*dayMs)return {ok:false,reason:'invalid_date_range'};
  if(input.holidays===null)return {ok:false,reason:'holiday_calendar_unconfigured'};
  if(input.holidays.some(h=>day(h)===null))return {ok:false,reason:'invalid_holiday'};
  if(input.schedules.some(s=>!validPeriod(s)||s.dailyMinutes.length!==7||s.dailyMinutes.some(m=>!nonnegative(m)||m>1440)))return {ok:false,reason:'invalid_schedule'};
  if(input.policies.some(p=>!validPeriod(p)))return {ok:false,reason:'invalid_policy_period'};
  const holidays=new Set(input.holidays);const days=[];let minutes=0;
  for(let n=start;n<=end;n+=dayMs) {
    const date=new Date(n).toISOString().slice(0,10);
    const policies=input.policies.filter(p=>covers(p,date));
    if(policies.length!==1||!policies[0].reviewed)return {ok:false,reason:'policy_missing_unreviewed_or_overlapping'};
    const schedules=input.schedules.filter(s=>!s.cancelled&&covers(s,date));
    if(schedules.length!==1)return {ok:false,reason:'schedule_missing_or_overlapping'};
    const holidayExcluded=policies[0].excludeHolidays&&holidays.has(date);
    const amount=holidayExcluded?0:schedules[0].dailyMinutes[(new Date(n).getUTCDay()+6)%7];
    minutes+=amount;days.push({date,minutes:amount,holidayExcluded});
  }
  return {ok:true,value:{minutes,days}};
}

export type LeaveLedgerEntry={id:string;date:string;minutes:number;kind:'opening'|'accrual'|'taken'|'adjustment'|'carryover';reference:string};
/** Ledger entries must already be authorized/posted. Pending requests aren't debits.
 * A carryover entry is an explicit signed adjustment, never an implicit annual reset.
 */
export function leaveBalance(entries:LeaveLedgerEntry[],asOf:string):Result<{minutes:number;entryCount:number}> {
  if(day(asOf)===null)return {ok:false,reason:'invalid_as_of'};
  const ids=new Set<string>();let minutes=0,entryCount=0;
  for(const e of entries) {
    if(!e.id||ids.has(e.id))return {ok:false,reason:'duplicate_or_missing_entry_id'};
    ids.add(e.id);
    if(day(e.date)===null||!Number.isSafeInteger(e.minutes)||!e.reference.trim()||!['opening','accrual','taken','adjustment','carryover'].includes(e.kind))return {ok:false,reason:'invalid_entry'};
    if((e.kind==='accrual'&&e.minutes<0)||(e.kind==='taken'&&e.minutes>0))return {ok:false,reason:'invalid_entry_sign'};
    if(e.date<=asOf){minutes+=e.minutes;entryCount++;if(!Number.isSafeInteger(minutes))return {ok:false,reason:'balance_overflow'};}
  }
  if(!entries.some(e=>e.kind==='opening'&&e.date<=asOf))return {ok:false,reason:'opening_balance_unconfigured'};
  if(entries.filter(e=>e.kind==='opening').length!==1)return {ok:false,reason:'multiple_opening_balances'};
  const opening=entries.find(e=>e.kind==='opening')!;
  if(entries.some(e=>e.date<opening.date))return {ok:false,reason:'entry_before_opening'};
  return {ok:true,value:{minutes,entryCount}};
}

/** Proposed posting, not an entitlement. Each period needs an explicit unique reference.
 * The persistence layer must enforce uniqueness transactionally on that reference.
 */
export function proposedAccrual(input:{reviewed:boolean;amountMinutes:number;currentBalanceMinutes:number;balanceCapMinutes:number|null;periodReference:string;postedReferences:string[]}):Result<{minutes:number;reference:string}> {
  if(!input.reviewed)return {ok:false,reason:'policy_unreviewed'};
  if(!nonnegative(input.amountMinutes)||!Number.isSafeInteger(input.currentBalanceMinutes)||(input.balanceCapMinutes!==null&&!nonnegative(input.balanceCapMinutes))||!input.periodReference.trim())return {ok:false,reason:'invalid_accrual_configuration'};
  if(input.postedReferences.includes(input.periodReference))return {ok:false,reason:'period_already_posted'};
  const available=input.balanceCapMinutes===null?input.amountMinutes:Math.max(0,input.balanceCapMinutes-input.currentBalanceMinutes);
  const minutes=Math.min(input.amountMinutes,available);
  if(!Number.isSafeInteger(input.currentBalanceMinutes+minutes))return {ok:false,reason:'balance_overflow'};
  return {ok:true,value:{minutes,reference:input.periodReference}};
}
