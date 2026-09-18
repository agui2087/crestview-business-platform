'use client';
export function PrintRecord({locale}:{locale:string}) {
  return <button className="button button--primary print-record-button" type="button" onClick={()=>window.print()}>{locale==='es'?'Imprimir / guardar PDF':'Print / save as PDF'}</button>;
}
