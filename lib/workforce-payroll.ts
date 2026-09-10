export const payrollColumns=['employee_id','period_start','period_end','currency','gross_pay','employer_cost','paid_hours','source_reference'] as const;
export type PayrollRow={employeeId:string;periodStart:string;periodEnd:string;currency:string;grossMinor:number;employerCostMinor:number;paidHoursHundredths:number;sourceReference:string};
const supportedCurrencies=new Set(['USD','EUR','GBP','CAD','AUD','MXN']); // this format uses two decimal places
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&s>='1900-01-01'&&s<='2200-12-31';
function fixed(s:string,max:number):number {
  if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(s))throw Error('Use nonnegative decimal numbers with at most two decimal places.');
  const [whole,fraction='']=s.split('.');const value=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(value)||value>max)throw Error('Numeric amount exceeds supported limits.');return value;
}
function cells(text:string):string[][] {
  if(new TextEncoder().encode(text).byteLength>1_000_000)throw Error('Import exceeds 1 MB text limit.');
  const result:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;const input=text.replace(/^\uFEFF/,'');
  for(let i=0;i<=input.length;i++) {
    const c=input[i];
    if(quoted){if(c===undefined)throw Error('Unclosed quoted field.');if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
    else if(c==='"'&&field===''&&!closed)quoted=true;
    else if(c===','||c==='\r'||c==='\n'||c===undefined){row.push(field.trim());field='';closed=false;if(c!==','){if(row.some(Boolean))result.push(row);row=[];if(c==='\r'&&input[i+1]==='\n')i++;}}
    else{if(closed||c==='"')throw Error('Malformed CSV quoting.');field+=c;}
    if(result.length>501)throw Error('Maximum 500 payroll rows per import.');
  }
  return result;
}
/** Canonical analytical input, NOT a payroll-provider upload or payment instruction.
 * Caller must separately authorize employee IDs before persisting any row.
 */
export function parsePayrollCsv(text:string):PayrollRow[] {
  const parsed=cells(text),header=parsed.shift()??[];
  if(header.length!==payrollColumns.length||new Set(header).size!==header.length||header.some(h=>!payrollColumns.includes(h as typeof payrollColumns[number])))throw Error('Use only the documented payroll-analysis columns. Bank, tax and other extra columns are not accepted.');
  if(!parsed.length||parsed.length>500)throw Error('Provide between 1 and 500 rows.');
  const seen=new Set<string>();
  return parsed.map((row,index)=>{
    try {
      if(row.length!==header.length)throw Error('Column count does not match the header.');
      const v=Object.fromEntries(header.map((h,i)=>[h,row[i]]));
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.employee_id))throw Error('Use the Crestview employee UUID, not a name or tax identifier.');
      if(!date(v.period_start)||!date(v.period_end)||v.period_end<v.period_start)throw Error('Invalid period dates.');
      const days=(Date.parse(v.period_end)-Date.parse(v.period_start))/86400000+1;
      if(days>366)throw Error('A period cannot exceed 366 days.');
      if(!supportedCurrencies.has(v.currency))throw Error('Unsupported currency for this two-decimal format.');
      if(!v.source_reference||v.source_reference.length>200||/^[=+\-@]/.test(v.source_reference)||/[\u0000-\u001f]/.test(v.source_reference))throw Error('Use a plain source reference of 1–200 characters.');
      const grossMinor=fixed(v.gross_pay,10_000_000_000),employerCostMinor=fixed(v.employer_cost,10_000_000_000),paidHoursHundredths=fixed(v.paid_hours,days*2400);
      if(employerCostMinor<grossMinor)throw Error('Total employer cost must include gross pay.');
      const employeeId=v.employee_id.toLowerCase(),key=`${employeeId}:${v.period_start}:${v.period_end}`;
      if(seen.has(key))throw Error('Duplicate employee and period. Consolidate source lines first.');seen.add(key);
      return {employeeId,periodStart:v.period_start,periodEnd:v.period_end,currency:v.currency,grossMinor,employerCostMinor,paidHoursHundredths,sourceReference:v.source_reference};
    }catch(error){throw Error(`Row ${index+2}: ${error instanceof Error?error.message:'Invalid row.'}`);}
  });
}
/** Never combines currencies or different period boundaries into one total. */
export function payrollSummary(rows:PayrollRow[]) {
  const groups=new Map<string,{currency:string;periodStart:string;periodEnd:string;employees:number;grossMinor:number;employerCostMinor:number;paidHoursHundredths:number}>();
  for(const r of rows){const key=`${r.currency}:${r.periodStart}:${r.periodEnd}`;const g=groups.get(key)??{currency:r.currency,periodStart:r.periodStart,periodEnd:r.periodEnd,employees:0,grossMinor:0,employerCostMinor:0,paidHoursHundredths:0};g.employees++;g.grossMinor+=r.grossMinor;g.employerCostMinor+=r.employerCostMinor;g.paidHoursHundredths+=r.paidHoursHundredths;groups.set(key,g);}
  return [...groups.values()].sort((a,b)=>a.periodStart.localeCompare(b.periodStart)||a.currency.localeCompare(b.currency));
}
