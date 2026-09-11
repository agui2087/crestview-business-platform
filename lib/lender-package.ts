export type LenderPackageInput = {
  locale: string; title: string; location: string; industry: string; askingPrice: string; revenue: string; cashFlow: string;
  missing: string[]; records?: string[]; buyerContribution?: number; sellerNote?: number; workingCapital?: number;
};
export function lenderPackageText(p: LenderPackageInput) {
  const es=p.locale==='es';
  const money=new Intl.NumberFormat(es?'es-US':'en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const amount=(n:number|undefined)=>n===undefined?(es?'No indicado':'Not provided'):money.format(n);
  return [es?'CRESTVIEW — PREPARACIÓN PARA PRESTAMISTA':'CRESTVIEW — LENDER PREPARATION',
    `${es?'Oportunidad':'Opportunity'}: ${p.title}`,`${es?'Ubicación':'Location'}: ${p.location}`,`${es?'Industria':'Industry'}: ${p.industry}`,
    `${es?'Precio solicitado':'Asking price'}: ${p.askingPrice}`,`${es?'Ingresos declarados':'Reported revenue'}: ${p.revenue}`,`${es?'Flujo declarado':'Reported cash flow'}: ${p.cashFlow}`,
    `${es?'Aportación del comprador':'Buyer contribution'}: ${amount(p.buyerContribution)}`,`${es?'Financiamiento del vendedor':'Seller financing'}: ${amount(p.sellerNote)}`,`${es?'Capital de trabajo':'Working capital'}: ${amount(p.workingCapital)}`,'',
    es?'INVENTARIO DE DOCUMENTOS ACCESIBLES':'ACCESSIBLE DOCUMENT INVENTORY',
    ...(p.records?.length?p.records.map(title=>`- ${title}`):[es?'No hay documentos accesibles vinculados.':'No accessible linked documents.']),
    es?'Solo títulos; los archivos no se adjuntan ni se concede acceso al destinatario.':'Titles only; files are not attached and recipient access is not granted.','',
    es?'PENDIENTES O SIN VERIFICAR':'MISSING OR UNVERIFIED',
    ...(p.missing.length?p.missing.map(item=>`- ${item}`):[es?'No se registraron pendientes; esto no prueba que la revisión esté completa.':'No missing items recorded; this does not prove diligence is complete.']),'',
    es?'Revisa el contenido privado antes de compartir. Información declarada, no verificada por Crestview. No es una solicitud, aprobación de préstamo ni valoración.':'Review private content before sharing. Reported information, not verified by Crestview. Not a loan application, approval, or valuation.'
  ].join('\n');
}
