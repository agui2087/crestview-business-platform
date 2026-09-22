import {cashFlowLabels,figureTypeLabels} from '@/lib/listing-financial-context';
type Facts={financial_period_start?:string|null;financial_period_end?:string|null;cash_flow_basis?:string;financial_figure_type?:string;financial_context_note?:string};
export function ListingFinancialContext({listing,locale}:{listing:Facts;locale:string}){
 const es=locale==='es',language=es?1:0;
 const basis=cashFlowLabels[listing.cash_flow_basis as keyof typeof cashFlowLabels]??cashFlowLabels.not_specified;
 const figureType=figureTypeLabels[listing.financial_figure_type as keyof typeof figureTypeLabels]??figureTypeLabels.not_specified;
 return <div className="advisor-note"><p><strong>{es?'Contexto financiero del anuncio':'Listing financial context'}</strong></p>
 <p>{listing.financial_period_start&&listing.financial_period_end?`${es?'Período':'Period'}: ${listing.financial_period_start} – ${listing.financial_period_end}`:es?'Período no indicado. Pregunta antes de comparar cifras.':'Period not provided. Ask before comparing figures.'}</p>
 <p>{basis[language]} · {figureType[language]}</p>
 {listing.financial_context_note&&<p>{listing.financial_context_note}</p>}
 <small>{es?'Datos del corredor o vendedor, no verificados independientemente por Crestview. No equivales automáticamente ingresos, SDE, EBITDA y flujo de caja.':'Broker- or seller-provided, not independently verified by Crestview. Revenue, SDE, EBITDA and cash flow are not interchangeable.'}</small></div>;
}
