export type SearchQuery = Record<string, string | string[] | undefined>;
export const states: Record<string, string> = Object.fromEntries(
  'Alabama:AL|Alaska:AK|Arizona:AZ|Arkansas:AR|California:CA|Colorado:CO|Connecticut:CT|Delaware:DE|Florida:FL|Georgia:GA|Hawaii:HI|Idaho:ID|Illinois:IL|Indiana:IN|Iowa:IA|Kansas:KS|Kentucky:KY|Louisiana:LA|Maine:ME|Maryland:MD|Massachusetts:MA|Michigan:MI|Minnesota:MN|Mississippi:MS|Missouri:MO|Montana:MT|Nebraska:NE|Nevada:NV|New Hampshire:NH|New Jersey:NJ|New Mexico:NM|New York:NY|North Carolina:NC|North Dakota:ND|Ohio:OH|Oklahoma:OK|Oregon:OR|Pennsylvania:PA|Rhode Island:RI|South Carolina:SC|South Dakota:SD|Tennessee:TN|Texas:TX|Utah:UT|Vermont:VT|Virginia:VA|Washington:WA|West Virginia:WV|Wisconsin:WI|Wyoming:WY|District of Columbia:DC'.split('|').map(x => { const [name, code] = x.split(':'); return [name.toLowerCase(), code]; }),
);
export function normalizeSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function region(value: string) { return states[normalizeSearch(value)] ?? value.trim().toUpperCase(); }
export function matchesLocation(city: string, state: string, input: string) {
  if (!input.trim()) return true;
  const parts = input.split(',').map(x => x.trim());
  if (parts.length > 2) return false;
  if (parts.length === 2) return normalizeSearch(city) === normalizeSearch(parts[0]) && region(state) === region(parts[1]);
  if (states[normalizeSearch(input)] || Object.values(states).includes(input.trim().toUpperCase())) return region(state) === region(input);
  return normalizeSearch(city) === normalizeSearch(input);
}
export function parseAmount(value: string): number | null | undefined {
  if (!value.trim()) return null;
  if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value.trim())) return undefined;
  const amount = Number(value.trim().replace(/[$,]/g, ''));
  return Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER ? amount : undefined;
}
export const searchFields = ['q', 'city', 'industry', 'minPrice', 'maxPrice', 'minRevenue', 'minCashFlow', 'financing', 'sort'] as const;
export function searchValues(query: SearchQuery) {
  return Object.fromEntries(searchFields.map(key => [key, typeof query[key] === 'string' ? query[key] : ''])) as Record<typeof searchFields[number], string>;
}
type Listing = {title:string; summary:string; industry:string; city:string; state_code:string; asking_price:number|null; annual_revenue:number|null; cash_flow:number|null; financing_available:boolean; public_highlights:string[]; updated_at:string};
export function searchListings<T extends Listing>(items: T[], query: SearchQuery) {
  const values = searchValues(query);
  const amounts = {minPrice:parseAmount(values.minPrice),maxPrice:parseAmount(values.maxPrice),minRevenue:parseAmount(values.minRevenue),minCashFlow:parseAmount(values.minCashFlow)};
  const errors = Object.entries(amounts).filter(([, v])=>v===undefined).map(([k])=>k);
  if (amounts.minPrice != null && amounts.maxPrice != null && amounts.minPrice > amounts.maxPrice) errors.push('range');
  const tokens = normalizeSearch(values.q).split(' ').filter(Boolean);
  const results = errors.length ? [] : items.filter(item => {
    const haystack = normalizeSearch([item.title,item.summary,item.industry,item.city,item.state_code,...item.public_highlights].join(' '));
    return tokens.every(t=>haystack.includes(t)) && matchesLocation(item.city,item.state_code,values.city)
      && (!values.industry || normalizeSearch(item.industry)===normalizeSearch(values.industry))
      && (amounts.minPrice == null || (item.asking_price !== null && item.asking_price >= amounts.minPrice))
      && (amounts.maxPrice == null || (item.asking_price !== null && item.asking_price <= amounts.maxPrice))
      && (amounts.minRevenue == null || (item.annual_revenue !== null && item.annual_revenue >= amounts.minRevenue))
      && (amounts.minCashFlow == null || (item.cash_flow !== null && item.cash_flow >= amounts.minCashFlow))
      && (values.financing !== 'yes' || item.financing_available);
  });
  const numericSort: Record<string, [keyof Pick<Listing,'asking_price'|'annual_revenue'|'cash_flow'>, number]> = {'price-low':['asking_price',1],'price-high':['asking_price',-1],revenue:['annual_revenue',-1],'cash-flow':['cash_flow',-1]};
  const numeric = numericSort[values.sort];
  if (numeric) results.sort((a,b)=>{const av=a[numeric[0]],bv=b[numeric[0]];return av===null?(bv===null?0:1):bv===null?-1:(av-bv)*numeric[1];});
  else if(values.sort==='newest') results.sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  // Default order preserves disclosed paid placement supplied by the server.
  return {results,errors,values};
}
