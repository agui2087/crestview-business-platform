"use client";
import {useState} from "react";
import {defaultDealPlan, readDealPlan, type DealPlan} from "@/lib/acquisition-tailoring";
export function AcquisitionPlanSettings({plan,es,busy,onSave}: {plan:DealPlan|null;es:boolean;busy:boolean;onSave:(plan:DealPlan)=>Promise<boolean>}) {
  const [error,setError]=useState("");
  return <details className="acquisition-plan-settings"><summary>{es ? "Personalizar esta compra" : "Tailor this purchase"}</summary>
    <form onSubmit={async event=>{
      event.preventDefault(); const p=readDealPlan(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
      if(!p){setError(es?"Revisa las opciones.":"Review your selections.");return;}
      setError(""); if(!await onSave(p))setError(es?"No se guardó la configuración.":"The settings were not saved.");
    }}>
      <label>{es?"Financiamiento de esta compra":"Funding for this purchase"}<select name="financing" defaultValue={plan?.financing??defaultDealPlan.financing}>
        <option value="undecided">{es?"Por decidir":"Not decided"}</option><option value="cash">{es?"Solo efectivo":"All cash"}</option><option value="sba">SBA</option><option value="conventional">{es?"Préstamo convencional":"Conventional loan"}</option><option value="seller">{es?"Financiamiento del vendedor":"Seller financing"}</option>
      </select></label>
      <label>{es?"Sector de esta compra":"Industry for this purchase"}<select name="industry" defaultValue={plan?.industry??"general"}>
        {Object.entries(es?{general:"General",service:"Servicios",retail:"Comercio",manufacturing:"Manufactura",healthcare:"Salud"}:{general:"General",service:"Services",retail:"Retail",manufacturing:"Manufacturing",healthcare:"Healthcare"}).map(([value,name])=><option value={value} key={value}>{name}</option>)}
      </select></label>
      {(["employees","property"] as const).map(name=><label key={name}>{name==="employees"?(es?"¿Se transfieren empleados?":"Are employees transferring?"):(es?"¿Se incluye propiedad inmobiliaria?":"Is real estate included?")}<select name={name} defaultValue={plan?.[name]??"unknown"}><option value="unknown">{es?"Sin confirmar":"Not confirmed"}</option><option value="yes">{es?"Sí":"Yes"}</option><option value="no">{es?"No":"No"}</option></select></label>)}
      <p>{es?"Cambiar la configuración reabre las revisiones de etapas y las tareas cuyo contenido cambia. Conserva las notas y el trabajo no afectado. Nada se marca como no aplicable automáticamente.":"Changing these settings reopens stage reviews and tasks whose wording changes. Notes and unaffected work remain. Nothing is marked not applicable automatically."}</p>
      {error&&<p role="alert">{error}</p>}<button className="button button--light" disabled={busy} type="submit">{es?"Guardar configuración":"Save purchase settings"}</button>
    </form>
  </details>;
}
