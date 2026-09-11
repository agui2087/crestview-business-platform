import {createSupabaseServerClient} from '@/lib/supabase/server';
import {listingProductsEnabled} from '@/lib/billing-availability';
import type {MarketplaceListing} from '@/lib/marketplace';
type Order={id:string;listing_id:string;product_code:string;status:string;ends_at:string|null;created_at:string};
const products=[['single_listing','$30'],['enhanced_visibility','$49.99'],['highest_visibility','$99.99']] as const;
function productName(code:string,es:boolean){return code==='single_listing'?(es?'Una publicación':'Single Listing'):code==='highest_visibility'?(es?'Máxima visibilidad':'Highest Visibility'):(es?'Visibilidad mejorada':'Enhanced Visibility');}
export async function ListingPurchases({userId,listings,locale,purchase}:{userId?:string;listings:MarketplaceListing[];locale:string;purchase?:string|string[]}){
  if(!listingProductsEnabled())return null;
  const es=locale==='es';
  if(!userId)return <section id="listing-purchases" className="panel"><h2>{es?'Productos para anuncios':'Listing products'}</h2><p>{es?'Inicia sesión para seleccionar un anuncio real.':'Sign in to select a real listing.'}</p></section>;
  const supabase=await createSupabaseServerClient();
  const [{data,error},{data:plan,error:planError},{data:metrics,error:metricsError}]=await Promise.all([
    supabase.from('listing_product_orders').select('id,listing_id,product_code,status,ends_at,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(200),
    supabase.from('billing_entitlements').select('active,expires_at').eq('user_id',userId).eq('product_code','broker_plan').maybeSingle(),
    supabase.rpc('my_listing_promotion_metrics'),
  ]);
  if(error||planError||metricsError)throw new Error('Listing purchase status could not be loaded.');
  const orders=(data??[]) as Order[];
  const daily=(metrics??[]) as {order_id:string;day:string;views:number;engagements:number}[];
  const brokerActive=plan?.active&&(!plan.expires_at||new Date(plan.expires_at)>new Date());
  return <section id="listing-purchases" className="panel" style={{padding:'1.5rem',marginBlock:'1.5rem'}}>
    <h2>{es?'Publicación y promociones':'Listing purchases and promotions'}</h2>
    <p>{es?'Selecciona un anuncio propio. El pago no publica automáticamente ni evita el requisito de NDA.':'Choose your own listing. Payment does not automatically publish it or bypass the NDA requirement.'}</p>
    <p>{es?'Las promociones duran 30 días calendario desde la confirmación del pago. Solo se muestran en resultados pertinentes mientras el anuncio está publicado y vigente. No garantizan consultas ni una venta.':'Promotions run for 30 calendar days from payment confirmation. They appear only in relevant results while the listing is published and current. They do not guarantee inquiries or a sale.'}</p>
    {purchase && <p role="status">{es?'Revisa el estado confirmado abajo. Volver de la página de pago no confirma un cobro. Actualiza la página si el pago sigue procesándose.':'Review the confirmed status below. Returning from checkout does not confirm a charge. Refresh if payment is still processing.'}</p>}
    {purchase==='review_required'&&<p role="alert">{es?'No se pudo cancelar este pago. Puede estar procesándose. Revisa Administrar facturación antes de intentar otro pago.':'This checkout could not be canceled and may already be processing. Check Manage billing before attempting another payment.'}</p>}
    <a className="button button--light" href={`/${locale}/pricing`}>{es?'Administrar facturación':'Manage billing'}</a>
    {listings.filter(l=>!l.id.startsWith('demo-')).map(l=>{
      const own=orders.filter(o=>o.listing_id===l.id);
      const pending=own.find(o=>o.status==='pending');
      const license=own.some(o=>o.product_code==='single_listing'&&o.status==='paid'&&!o.ends_at);
      const promotion=own.find(o=>o.product_code!=='single_listing'&&o.status==='paid'&&o.ends_at&&new Date(o.ends_at)>new Date());
      return <article key={l.id} style={{borderTop:'1px solid #cbd7ce',paddingBlock:'1rem'}}>
        <h3>{l.title}</h3>
        {license && <p>{es?'Publicación individual pagada. Puedes publicar cuando el NDA esté listo.':'Single Listing paid. You can publish when the NDA is ready.'}</p>}
        {promotion && <p>{productName(promotion.product_code,es)} · {es?'Finaliza':'Ends'} {new Date(promotion.ends_at!).toLocaleString(es?'es-US':'en-US',{timeZone:'UTC'})} UTC</p>}
        {own.filter(o=>o.product_code!=='single_listing'&&o.status!=='pending').slice(0,3).map(o=>{
          const rows=daily.filter(d=>d.order_id===o.id);const views=rows.reduce((n,d)=>n+Number(d.views),0),engagements=rows.reduce((n,d)=>n+Number(d.engagements),0);
          return <details key={o.id}><summary>{productName(o.product_code,es)} · {es?'Resultados':'Results'}</summary>
            <p>{views} {es?'vistas de miembros':'member card views'} · {engagements} {es?'interacciones':'engagements'}</p>
            <p>{es?'Una vista o interacción por miembro y día UTC; excluye tu cuenta y visitantes sin sesión. No son ventas ni compradores únicos durante toda la campaña.':'At most one view or engagement per member per UTC day; excludes your account and signed-out visitors. These are not sales or campaign-wide unique buyers.'}</p>
            {o.product_code==='highest_visibility'&&<ul>{rows.slice(0,30).map(d=><li key={d.day}>{d.day} · {d.views} {es?'vistas':'views'} · {d.engagements} {es?'interacciones':'engagements'}</li>)}</ul>}
          </details>;
        })}
        {pending?<div><p>{es?'Hay un pago pendiente para este anuncio.':'This listing has a pending checkout.'}</p>
          <form action="/api/stripe/checkout" method="post"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="listing_id" value={l.id}/><input type="hidden" name="product_code" value={pending.product_code}/><button className="button button--primary">{es?'Continuar pago':'Resume checkout'}</button></form>
          <form action="/api/stripe/listing-checkout/cancel" method="post"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="order_id" value={pending.id}/><button className="button button--light">{es?'Cancelar pago pendiente':'Cancel pending checkout'}</button></form>
        </div>:<div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>{products.filter(([code])=>code==='single_listing'?l.status==='draft'&&!brokerActive&&!license:l.status==='published'&&!promotion).map(([code,price])=><form key={code} action="/api/stripe/checkout" method="post">
          <input type="hidden" name="locale" value={locale}/><input type="hidden" name="listing_id" value={l.id}/><input type="hidden" name="product_code" value={code}/>
          <button className="button button--primary">{productName(code,es)} · {price}</button>
        </form>)}</div>}
        {l.status==='draft'&&!license&&!brokerActive&&<p>{es?'Antes de pagar, guarda el borrador y agrega un NDA autorizado y revisado.':'Before paying, save the draft and attach an authorized, reviewed NDA.'}</p>}
      </article>;
    })}
    {!listings.length&&<p>{es?'Crea un borrador arriba para comenzar.':'Create a listing draft above to get started.'}</p>}
    {orders.length>0&&<details><summary>{es?'Historial reciente de compras':'Recent purchase history'}</summary><ul>{orders.slice(0,20).map(o=><li key={o.id}>{productName(o.product_code,es)} · {es?({pending:'Pendiente',paid:'Pagado',expired:'Pago vencido',revoked:'Revocado'}[o.status]??o.status):o.status} · {new Date(o.created_at).toLocaleDateString(es?'es-US':'en-US')}</li>)}</ul><p>{es?'Se muestran hasta 20 compras recientes.':'Showing up to 20 recent purchases.'}</p></details>}
  </section>;
}
