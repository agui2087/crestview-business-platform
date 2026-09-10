"use client";
import {useActionState,useState} from 'react';
import {parsePayrollCsv,payrollColumns,payrollSummary,type PayrollRow} from '@/lib/workforce-payroll';
import {importPayroll} from './actions';

export default function PayrollImport({locale,owner}:{locale:string;owner:string}) {
  const t=(en:string,es:string)=>locale==='es'?es:en;
  const [csv,setCsv]=useState(''),[rows,setRows]=useState<PayrollRow[]>([]),[error,setError]=useState('');
  const [state,action,pending]=useActionState(importPayroll,{error:''});
  const preview=()=>{try{setRows(parsePayrollCsv(csv));setError('');}catch(e){setRows([]);setError(e instanceof Error?e.message:'Invalid CSV');}};
  const money=(value:number,currency:string)=>new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'code'}).format(value/100);
  return <section className="panel"><h2>{t('Review an import','Revisar una importación')}</h2>
    <p>{t('Paste CSV containing only these columns. Use employee IDs from the source-mapping list above, ISO dates and decimal amounts with a dot. Maximum 500 rows and 1 MB. No bank, tax or national identifiers.','Pega CSV con solo estas columnas. Usa identificadores de la lista de mapeo anterior, fechas ISO e importes decimales con punto. Máximo 500 filas y 1 MB. Sin datos bancarios, fiscales ni identificadores nacionales.')}</p>
    <p style={{overflowWrap:'anywhere'}}><code>{payrollColumns.join(',')}</code></p>
    <p>{t('Employer cost is the total including gross pay. Paid hours are source-reported paid hours, not measured working time. Supported currencies: USD, EUR, GBP, CAD, AUD, MXN. Consolidate each employee’s source lines into one period row. Negative corrections are not accepted.','El costo del empleador es el total incluido el salario bruto. Las horas pagadas provienen de la fuente, no de fichajes. Monedas: USD, EUR, GBP, CAD, AUD, MXN. Consolida las líneas de cada empleado en una fila por período. No se aceptan correcciones negativas.')}</p>
    <label>{t('Payroll analysis CSV','CSV de análisis de nómina')}<textarea value={csv} rows={8} onChange={e=>{setCsv(e.target.value);setRows([]);setError('');}} maxLength={1000000}/></label>
    <button type="button" onClick={preview}>{t('Validate and preview','Validar y previsualizar')}</button>
    {error&&<p role="alert">{locale==='es'?'Error de formato CSV: ':''}{error}</p>}
    {rows.length>0&&<><h3>{t('Preview — not saved','Vista previa — sin guardar')}</h3><p>{rows.length} {t('rows. Totals stay separate by exact period and currency.','filas. Totales separados por período exacto y moneda.')}</p>
      {payrollSummary(rows).map(g=><section key={`${g.periodStart}:${g.periodEnd}:${g.currency}`}><h4>{g.periodStart} — {g.periodEnd} ({g.currency})</h4><p>{t('Gross pay','Salario bruto')}: {money(g.grossMinor,g.currency)}. {t('Total employer cost','Costo total del empleador')}: {money(g.employerCostMinor,g.currency)}. {t('Paid hours','Horas pagadas')}: {(g.paidHoursHundredths/100).toFixed(2)}.</p></section>)}
      <details><summary>{t('Review every source row','Revisar todas las filas de origen')}</summary>{rows.map((r,i)=><p key={i} style={{overflowWrap:'anywhere'}}>{r.employeeId} · {r.periodStart} — {r.periodEnd} · {t('Gross','Bruto')}: {money(r.grossMinor,r.currency)} · {t('Total cost','Costo total')}: {money(r.employerCostMinor,r.currency)} · {t('Paid hours','Horas pagadas')}: {(r.paidHoursHundredths/100).toFixed(2)} · {r.sourceReference}</p>)}</details>
      <form action={action}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="owner" value={owner}/><input type="hidden" name="csv" value={csv}/>
        <label>{t('Unique source/batch reference','Referencia única del lote/origen')}<input name="reference" required maxLength={200}/></label>
        <label><input name="reviewed" type="checkbox" value="yes" required/>{t('I reviewed the employee IDs, periods, currencies and amounts against the source. Save these analytical records only; do not send payments.','Revisé identificadores, períodos, monedas e importes con la fuente. Guardar solo registros analíticos; no enviar pagos.')}</label>
        {state.error&&<p role="alert">{state.error}</p>}<button disabled={pending}>{pending?t('Saving…','Guardando…'):t('Save reviewed import','Guardar importación revisada')}</button>
      </form></>}
  </section>;
}
