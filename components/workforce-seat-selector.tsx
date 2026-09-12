"use client";
import {useState} from 'react';
import {MAX_WORKFORCE_SEATS,WORKFORCE_SEAT_USD,parseWorkforceSeats} from '@/lib/workforce-seat-pricing';
export function WorkforceSeatSelector({locale}:{locale:string}) {
  const [count,setCount]=useState('1');
  const es=locale==='es';
  let total:string|null=null;
  try {total=new Intl.NumberFormat(es?'es-US':'en-US',{style:'currency',currency:'USD'}).format(parseWorkforceSeats(count)*WORKFORCE_SEAT_USD);} catch {}
  return <>
    <label htmlFor="workforce-quantity">{es?'Número de empleados':'Employee count'}</label>
    <input id="workforce-quantity" name="quantity" type="number" inputMode="numeric" min={1} max={MAX_WORKFORCE_SEATS} step={1} required value={count} onChange={e=>setCount(e.target.value)} aria-describedby="workforce-total"/>
    <p id="workforce-total" role="status">{total?`${total}/${es?'mes':'month'} · ${es?'antes de impuestos':'before taxes'}`:es?'Ingresa un número entero de empleados.':'Enter a whole employee count.'}</p>
  </>;
}
