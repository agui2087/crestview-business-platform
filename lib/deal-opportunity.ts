import type {Opportunity} from "./demo-data";

export function inquiryIdFromOpportunity(key:string) {
  return /^deal-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key) ? key.slice(5) : null;
}

export function dealOpportunity(inquiry:{id:string;subject:string;updated_at:string;status:string},listing:{title:string;summary?:string;city?:string;state_code?:string;industry?:string;asking_price?:number|null;annual_revenue?:number|null;cash_flow?:number|null;public_highlights?:string[]}|null,locale:string):Opportunity {
  const format=(amount:number|null|undefined)=>amount == null ? (locale === "es" ? "No disponible" : "Not provided") : new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(amount);
  return {
    id:`deal-${inquiry.id}`,title:listing?.title ?? inquiry.subject,publicBusinessName:null,
    location:[listing?.city,listing?.state_code].filter(Boolean).join(", ") || "Not provided",
    industry:listing?.industry ?? "Not provided",price:format(listing?.asking_price),priceValue:listing?.asking_price ?? null,
    revenue:format(listing?.annual_revenue),revenueValue:listing?.annual_revenue ?? null,
    cashFlow:format(listing?.cash_flow),cashFlowValue:listing?.cash_flow ?? null,ebitda:format(null),ebitdaValue:null,
    status:inquiry.status,source:"Crestview broker listing",sourceId:inquiry.id,
    sourceUrl:`/${locale}/dashboard/deals/${inquiry.id}`,lastChecked:inquiry.updated_at.slice(0,10),
    description:listing?.summary ?? (locale === "es" ? "Consulta el espacio compartido para confirmar los datos con el corredor." : "Open the shared deal room to confirm details with the broker."),
    highlights:listing?.public_highlights ?? [],missing:["Verified financial records","Closing terms","Transition obligations"],
  };
}
