'use client';
import {useEffect,useRef} from 'react';
export function PromotionEngagement({listingId}:{listingId:string}){
  const marker=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const card=marker.current?.closest('article');if(!card)return;
    const sent=new Set<string>();
    const record=(kind:string)=>{
      if(sent.has(kind))return;sent.add(kind);
      void fetch('/api/listing-promotion/engagement',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listing_id:listingId,kind}),keepalive:true}).catch(()=>{});
    };
    let timer:ReturnType<typeof setTimeout>|undefined;
    const observer=new IntersectionObserver(([entry])=>{
      if(timer)clearTimeout(timer);
      if(entry.isIntersecting)timer=setTimeout(()=>{if(document.visibilityState==='visible')record('view');},1000);
    },{threshold:0.5});observer.observe(card);
    const click=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('summary,button,a'))record('engagement');};
    card.addEventListener('click',click);
    return()=>{observer.disconnect();if(timer)clearTimeout(timer);card.removeEventListener('click',click);};
  },[listingId]);
  return <span ref={marker} aria-hidden="true"/>;
}
