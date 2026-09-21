import type {SignatureAppearance} from '@/lib/nda-signature';
export function NdaSignaturePreview({appearance,name,es}:{appearance:SignatureAppearance;name:string;es:boolean}) {
 if(appearance.mode==='drawn')return <svg viewBox="0 0 600 180" width="100%" height="100%" role="img" aria-label={`${es?'Firma dibujada':'Drawn signature'}: ${name}`}>{appearance.strokes.map((s,i)=><polyline key={i} points={s.map(p=>`${p[0]*600},${p[1]*180}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3"/>)}</svg>;
 if(appearance.mode==='uploaded')return <span role="img" aria-label={`${es?'Firma subida':'Uploaded signature'}: ${name}`} style={{display:'block',width:'100%',height:'100%',backgroundImage:`url(${appearance.image})`,backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat'}}/>;
 return <>{name}</>;
}
