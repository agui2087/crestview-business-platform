export type Promotion={listing_id:string;tier:string;ends_at:string};
export function applyListingPlacement<T extends {id:string;updated_at:string}>(listings:T[],promotions:Promotion[],now=Date.now()){
  const active=new Map(promotions.filter(p=>['enhanced_visibility','highest_visibility'].includes(p.tier)&&new Date(p.ends_at).getTime()>now).map(p=>[p.listing_id,p]));
  const rank=(id:string)=>active.get(id)?.tier==='highest_visibility'?2:active.has(id)?1:0;
  return listings.map(listing=>({...listing,promotion:active.get(listing.id)})).sort((a,b)=>rank(b.id)-rank(a.id)||new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()||a.id.localeCompare(b.id));
}
