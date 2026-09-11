export function ListingPromotionLabel({tier,locale}:{tier?:string;locale:string}){
  if(!tier)return null;
  return <p className="listing-promotion-label" style={{background:'#e8efd8',color:'#173d31',padding:'0.5rem 0.75rem',borderRadius:'0.5rem',fontWeight:700}}>
    {locale==='es'?'Patrocinado':'Sponsored'} · {tier==='highest_visibility'?(locale==='es'?'Ubicación prioritaria':'Priority placement'):(locale==='es'?'Anuncio destacado':'Featured listing')}
    <small style={{display:'block',fontWeight:400}}>{locale==='es'?'La promoción no cambia la puntuación independiente.':'Promotion does not change the independent score.'}</small>
  </p>;
}
