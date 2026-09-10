import "server-only";
import {getOpportunity,type Opportunity} from "@/lib/demo-data";
import {createSupabaseServerClient,isSupabaseConfigured} from "@/lib/supabase/server";
import {dealOpportunity,inquiryIdFromOpportunity} from "@/lib/deal-opportunity";

// Existing catalog plans and private plans for actual broker inquiries share the
// same checklist. A broker or unrelated buyer must never resolve another buyer's plan.
export async function resolveOpportunities(keys:string[],locale:string):Promise<Map<string,Opportunity>> {
  const resolved=new Map<string,Opportunity>();
  for(const key of keys){const catalog=getOpportunity(key);if(catalog)resolved.set(key,catalog);}
  const ids=[...new Set(keys.map(inquiryIdFromOpportunity).filter((id):id is string=>Boolean(id)))];
  if(!ids.length || !isSupabaseConfigured())return resolved;
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return resolved;
  const {data,error}=await supabase.from("deal_inquiries")
    .select("id,subject,status,updated_at,marketplace_listings(title,summary,city,state_code,industry,asking_price,annual_revenue,cash_flow,public_highlights)")
    .eq("buyer_id",user.id).in("id",ids);
  if(error)throw new Error("The acquisition workspace could not be loaded.");
  for(const inquiry of data ?? []){
    const listing=Array.isArray(inquiry.marketplace_listings) ? inquiry.marketplace_listings[0] ?? null : inquiry.marketplace_listings;
    const opportunity=dealOpportunity(inquiry,listing,locale);resolved.set(opportunity.id,opportunity);
  }
  return resolved;
}

export async function resolveOpportunity(key:string,locale:string) {
  return (await resolveOpportunities([key],locale)).get(key) ?? null;
}
