import {z} from 'zod';
export const ndaFieldSchema=z.object({id:z.string().uuid(),type:z.enum(['signature','initials','date','name','company','title','text','checkbox','dropdown']),role:z.enum(['buyer','broker']).optional(),label:z.string().trim().max(60).optional(),required:z.boolean().optional(),options:z.array(z.string().trim().min(1).max(60).regex(/^[^\r\n\t]+$/)).min(2).max(12).optional(),validation:z.enum(['text','email','number']).optional(),page:z.number().int().min(1).max(50),x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().min(.08).max(.8),height:z.number().min(.025).max(.2)}).strict().refine(f=>f.x+f.width<=1.000001&&f.y+f.height<=1.000001,'Field must fit on the page').refine(f=>!['signature','initials','date','name'].includes(f.type)||f.required!==false,'Identity fields must be required').refine(f=>f.type==='dropdown'?!!f.options&&new Set(f.options).size===f.options.length:!f.options,'Dropdowns need distinct options').refine(f=>!f.validation||f.type==='text','Validation applies to text fields');
export const ndaFieldsSchema=z.array(ndaFieldSchema).min(1).max(50).refine(fs=>fs.some(f=>f.type==='signature'),'Add at least one signature field').refine(fs=>new Set(fs.map(f=>f.id)).size===fs.length,'Field IDs must be unique').refine(fs=>!fs.some((a,i)=>fs.slice(i+1).some(b=>a.page===b.page&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)),'Fields must not overlap');
export type NdaField=z.infer<typeof ndaFieldSchema>;
export type SignerRole='buyer'|'broker';
export type NdaLayout={fields:NdaField[];sha256:string;pages:number;revision:string;order?:'buyer_first'|'broker_first'|'any'};
export const fieldRole=(f:NdaField):SignerRole=>f.role??'buyer';
export const fieldRequired=(f:NdaField)=>f.required!==false;
export const signerRoles=(layout:NdaLayout):SignerRole[]=>[...new Set(layout.fields.map(fieldRole))];
export function canSignerProceed(layout:NdaLayout,role:SignerRole,signed:SignerRole[]) {
 if(!signerRoles(layout).includes(role)||signed.includes(role))return false;
 const first=layout.order==='broker_first'?'broker':'buyer';
 return layout.order==='any'||role===first||!signerRoles(layout).includes(first)||signed.includes(first);
}
export function parseNdaLayout(raw:unknown):NdaLayout {
 return z.object({fields:ndaFieldsSchema,sha256:z.string().regex(/^[a-f0-9]{64}$/),pages:z.number().int().min(1).max(50),revision:z.string().uuid(),order:z.enum(['buyer_first','broker_first','any']).optional()}).strict().refine(v=>v.fields.every(f=>f.page<=v.pages)).refine(v=>v.fields.some(f=>fieldRole(f)==='buyer'&&f.type==='signature'),'Buyer signature required').refine(v=>signerRoles(v).every(role=>v.fields.some(f=>fieldRole(f)===role&&f.type==='signature')),'Each signer needs a signature field').parse(raw);
}
export function valuesForFields(fields:NdaField[],name:string,initials:string,completed:string[],stamp:Date,extra:Record<string,string>={}) {
 const legalName=z.string().trim().min(2).max(100).regex(/^[^\r\n\t]+$/).parse(name);
 const shortName=fields.some(f=>f.type==='initials')?z.string().trim().min(1).max(12).regex(/^[^\r\n\t]+$/).parse(initials):'';
 if(fields.some(f=>fieldRequired(f)&&!completed.includes(f.id))||completed.some(id=>!fields.some(f=>f.id===id))||new Set(completed).size!==completed.length)throw Error('Complete every required field before signing');
 return Object.fromEntries(fields.map(f=>{
  const raw=extra[f.id]?.trim()??'';
  if(!fieldRequired(f)&&!raw)return [f.id,''];
  if(!completed.includes(f.id))throw Error('Acknowledge each filled field');
  const value=f.type==='date'?stamp.toISOString().slice(0,10):f.type==='initials'?shortName:['signature','name'].includes(f.type)?legalName:f.type==='checkbox'?z.literal('Yes').parse(raw):z.string().trim().min(1).max(100).regex(/^[^\r\n\t]+$/).parse(raw);
  if(f.type==='dropdown'&&!f.options?.includes(value))throw Error('Choose a listed option');
  if(f.validation==='email')z.string().email().parse(value);
  if(f.validation==='number'&&(!/^-?\d+(\.\d+)?$/.test(value)||!Number.isFinite(Number(value))))throw Error('Enter a number');
  return [f.id,value];
 }));
}
