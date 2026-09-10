import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {formatLeaveMinutes} from '@/lib/workforce-leave-display';
import {proposedAccrual} from '@/lib/workforce-leave';
import {saveAccrual} from './actions';
import '../../operations/workforce-operations.css';

export default async function Accrual({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{policy?:string;amount?:string;notice?:string}>}) {
  const {locale}=await params;if(!isLocale(locale))notFound();
  const t=(en:string,es:string)=>locale==='es'?es:en;
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();
  if(!user)redirect(`/${locale}/sign-in`);
  const query=await searchParams;
  const policies=await db.from('workforce_leave_policies').select('id,employee_id,leave_type,starts_on,ends_on,version,accrual_minutes,balance_cap_minutes').eq('owner_id',user.id).order('starts_on',{ascending:false}).limit(500);
  const selected=(policies.data??[]).find(p=>p.id===query.policy);
  const today=new Date().toISOString().slice(0,10);
  const [balance,rule,runs,history,person]=selected?await Promise.all([
    db.rpc('workforce_leave_balance',{p_policy:selected.id,p_as_of:today}),
    db.from('workforce_accrual_rules').select('version,enabled,amount_minutes,next_on,review_reference').eq('policy_id',selected.id).maybeSingle(),
    db.from('workforce_accrual_runs').select('id,period_on,status,detail,minutes,created_at').eq('policy_id',selected.id).order('created_at',{ascending:false}).limit(30),
    db.from('workforce_accrual_history').select('id,reason,created_at').eq('policy_id',selected.id).order('created_at',{ascending:false}).limit(30),
    db.from('employees').select('full_name,archived_at,employment_status').eq('id',selected.employee_id).maybeSingle(),
  ]):[{data:null,error:null},{data:null,error:null},{data:[],error:null},{data:[],error:null},{data:null,error:null}];
  const failed=policies.error||balance.error||rule.error||runs.error||history.error||person.error;
  const total=balance.data?.[0];
  const amount=query.amount&&/^\d+$/.test(query.amount)?Number(query.amount):NaN;
  const next=new Date(`${today}T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1,1);const first=next.toISOString().slice(0,10);
  const eligible=selected&&person.data&&!person.data.archived_at&&person.data.employment_status==='active'&&total?.configured&&selected.starts_on<=first&&(!selected.ends_on||selected.ends_on>=first);
  const preview=eligible&&Number.isSafeInteger(amount)&&amount>0&&amount<=selected.accrual_minutes?proposedAccrual({reviewed:true,amountMinutes:amount,currentBalanceMinutes:Number(total.minutes),balanceCapMinutes:selected.balance_cap_minutes,periodReference:first,postedReferences:[]}):null;
  const hidden=(operation:string)=><><input type="hidden" name="locale" value={locale}/><input type="hidden" name="policy" value={selected?.id??''}/><input type="hidden" name="operation" value={operation}/><input type="hidden" name="version" value={rule.data?.version??0}/></>;
  return <PlatformShell locale={locale} active="workforce"><div className="dashboard-content wf-ops">
    <PageHeading eyebrow={t('Owner controls','Controles del propietario')} title={t('Reviewed monthly accrual','Acumulación mensual revisada')} body={t('Separate opt-in. Existing policies remain manual until the owner approves automation.','Activación independiente. Las políticas siguen siendo manuales hasta que el propietario apruebe la automatización.')} action={<Link href={`/${locale}/dashboard/workforce/leave`}>{t('Leave ledger','Registro de ausencias')}</Link>}/>
    <p>{t('Fixed monthly credits only, starting next month on the first day in UTC. No proration, hours-worked rules, automatic backfill, forfeiture or payroll payments. An hourly job checks due rules; posting may occur later in the same month. Missed months, changed policies and inactive employees pause the rule for review. Owners must confirm this method matches their adopted policy.','Solo créditos mensuales fijos, desde el primer día del próximo mes en UTC. Sin prorrateo, reglas por horas trabajadas, recuperación automática, pérdida de saldo ni pagos. Una tarea cada hora revisa las reglas; el registro puede ocurrir más tarde en el mismo mes. Meses omitidos, políticas modificadas o empleados inactivos pausan la regla. El propietario debe confirmar que el método corresponde a su política adoptada.')}</p>
    {query.notice==='saved'&&<p role="status">{t('Rule updated.','Regla actualizada.')}</p>}
    {query.notice==='failed'&&<p role="alert">{t('Nothing saved. Refresh and preview again; check ownership, policy dates, opening balance and review fields.','No se guardó nada. Actualiza y revisa la vista previa; verifica propietario, fechas, saldo inicial y campos de revisión.')}</p>}
    {failed?<p role="alert">{t('Could not load complete accrual data. No approval controls are shown.','No se pudieron cargar los datos completos. No se muestran controles de aprobación.')}</p>:<>
      <section className="panel"><h2>{t('Choose your policy','Elige tu política')}</h2><form method="get"><label>{t('Policy','Política')}<select name="policy" defaultValue={selected?.id??''} required><option value="">{t('Choose','Elegir')}</option>{(policies.data??[]).map(p=><option key={p.id} value={p.id}>{p.leave_type} · {p.starts_on} · {p.id.slice(0,8)}</option>)}</select></label><button>{t('Open policy','Abrir política')}</button></form>{!policies.data?.length&&<p>{t('No owned policies. Adopt a reviewed policy and opening balance first.','No hay políticas propias. Adopta primero una política revisada y un saldo inicial.')}</p>}{policies.data?.length===500&&<p>{t('List limited to 500 policies.','Lista limitada a 500 políticas.')}</p>}</section>
      {selected&&<section className="panel"><h2>{person.data?.full_name} · {selected.leave_type}</h2><p>{t('Automation','Automatización')}: <strong>{rule.data?.enabled?t('Enabled','Activada'):t('Off / paused','Desactivada / pausada')}</strong></p>
        {rule.data&&<p>{t('Approved amount','Cantidad aprobada')}: {formatLeaveMinutes(rule.data.amount_minutes,locale)}. {t('Next scheduled date','Próxima fecha programada')}: {rule.data.next_on} (UTC). {t('Review reference','Referencia de revisión')}: {rule.data.review_reference}</p>}
        {rule.data?.enabled&&<form action={saveAccrual}>{hidden('pause')}<label>{t('Reason for pausing','Motivo de pausa')}<textarea name="review" required maxLength={1000}/></label><button>{t('Pause future credits','Pausar créditos futuros')}</button></form>}
        <p>{t('Posted balance','Saldo registrado')}: {total?.configured?formatLeaveMinutes(Number(total.minutes),locale):t('Opening balance unconfigured','Saldo inicial sin configurar')}. {t('Monthly maximum','Máximo mensual')}: {formatLeaveMinutes(selected.accrual_minutes,locale)}.</p>
        {!eligible?<p>{t('Automation needs an active employee, an opening balance and a policy covering next month.','Se requiere un empleado activo, saldo inicial y política vigente el próximo mes.')}</p>:<form method="get"><input type="hidden" name="policy" value={selected.id}/><label>{t('Reviewed fixed monthly minutes','Minutos mensuales fijos revisados')}<input type="number" name="amount" min={1} max={selected.accrual_minutes} step={1} required defaultValue={query.amount??''}/></label><button>{t('Preview only — do not enable','Solo vista previa — no activar')}</button></form>}
        {query.amount&&!preview?.ok&&<p role="alert">{t('Enter a valid amount within the policy maximum to preview.','Ingresa una cantidad válida dentro del máximo de la política.')}</p>}
        {preview?.ok&&<><h3>{t('Review before enabling','Revisar antes de activar')}</h3><p>{t('Using today’s balance, the capped credit would be','Con el saldo actual, el crédito limitado sería')} <strong>{formatLeaveMinutes(preview.value.minutes,locale)}</strong>. {t('This is an estimate, not a posted credit. The actual amount is recalculated at execution and may be zero at the cap. Existing monthly accrual prevents a second credit.','Es una estimación, no un crédito registrado. La cantidad se recalcula al ejecutar y puede ser cero al alcanzar el límite. Una acumulación mensual existente impide un segundo crédito.')}</p><p>{t('First eligible date','Primera fecha elegible')}: {first} (UTC).</p>
          <form action={saveAccrual}>{hidden('enable')}<input type="hidden" name="amount" value={amount}/><input type="hidden" name="balance" value={total.minutes}/><input type="hidden" name="policy_version" value={selected.version}/><label>{t('Adopted policy review reference; no sensitive details','Referencia de política adoptada; sin datos sensibles')}<textarea name="review" required maxLength={1000}/></label><label><input type="checkbox" name="confirmed" value="yes" required/>{t('I approve this fixed amount and UTC monthly schedule for this employee. Re-enabling starts next month and does not backfill prior months.','Apruebo esta cantidad fija y calendario mensual UTC para este empleado. Reactivar comienza el próximo mes y no recupera meses anteriores.')}</label><button>{t('Enable reviewed monthly credits','Activar créditos mensuales revisados')}</button></form></>}
      </section>}
      {selected&&<section className="panel"><h2>{t('Latest 30 run results','Últimos 30 resultados')}</h2><ul>{(runs.data??[]).map(r=><li key={r.id}>{r.period_on} · {r.status==='posted'?t('Posted','Registrado'):r.status==='already_posted'?t('Existing monthly credit preserved','Crédito mensual existente conservado'):t('Paused: review required','Pausada: requiere revisión')} · {r.minutes===null?'':formatLeaveMinutes(r.minutes,locale)} · {r.detail}</li>)}</ul>{!runs.data?.length&&<p>{t('No scheduled runs yet.','Aún no hay ejecuciones programadas.')}</p>}<h3>{t('Latest 30 rule changes','Últimos 30 cambios')}</h3><ul>{(history.data??[]).map(h=><li key={h.id}>{h.created_at} · {h.reason}</li>)}</ul></section>}
    </>}
  </div></PlatformShell>;
}
