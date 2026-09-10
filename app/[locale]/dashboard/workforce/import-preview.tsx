"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { parseEmployeeCsv } from "@/lib/workforce";
import { importEmployees } from "./actions";

function ImportButton({ready,es}:{ready:boolean;es:boolean}) {
  const {pending}=useFormStatus();
  return <button className="button button--light" disabled={!ready||pending}>{pending?(es?"Importando…":"Importing…"):(es?"Confirmar importación":"Confirm import")}</button>;
}
export function EmployeeImport({locale}:{locale:string}) {
  const es=locale==="es";
  const [preview,setPreview]=useState<ReturnType<typeof parseEmployeeCsv>>([]);
  const [error,setError]=useState("");
  const [checking,setChecking]=useState(false);
  return <form className="csv-import" action={importEmployees}>
    <input type="hidden" name="locale" value={locale}/>
    <div><strong>{es?"Importar empleados desde CSV":"Import employees from CSV"}</strong><p>{es?"Máximo 500 empleados y 750 KB. Esta importación agrega perfiles; no actualiza ni combina duplicados.":"Maximum 500 employees and 750 KB. This import adds profiles; it does not update or merge duplicates."}</p><p><code>full_name,email,position,department,manager_name,start_date,employment_status,preferred_locale</code></p></div>
    <label>{es?"Archivo CSV":"CSV file"}<input type="file" name="file" accept=".csv,text/csv" required disabled={checking} onChange={async event=>{
      setPreview([]);setError("");const file=event.target.files?.[0];if(!file)return;
      setChecking(true);
      try {if(file.size>750000||!file.size)throw new Error();setPreview(parseEmployeeCsv(await file.text()));}
      catch {setError(es?"No se puede importar. Revisa encabezados, fechas, filas y tamaño.":"Cannot import this file. Check headers, dates, rows and file size.");}
      finally {setChecking(false);}
    }}/></label>
    {error&&<p role="alert">{error}</p>}
    {!!preview.length&&<div role="status"><p>{preview.length} {es?"perfiles listos para agregar. Vista previa:":"profiles ready to add. Preview:"}</p><ul>{preview.slice(0,5).map((row,i)=><li key={i}>{row.full_name} · {row.department||"—"} · {row.employment_status} · {row.preferred_locale}</li>)}</ul></div>}
    <ImportButton ready={!!preview.length&&!checking} es={es}/>
  </form>;
}
