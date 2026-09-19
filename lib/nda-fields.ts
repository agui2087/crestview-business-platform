import {z} from 'zod';
export const ndaFieldSchema=z.object({id:z.string().uuid(),type:z.enum(['signature','initials','date']),page:z.number().int().min(1).max(50),x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().min(.08).max(.8),height:z.number().min(.025).max(.2)}).strict().refine(f=>f.x+f.width<=1.000001&&f.y+f.height<=1.000001,'Field must fit on the page');
export const ndaFieldsSchema=z.array(ndaFieldSchema).min(1).max(50).refine(fs=>fs.some(f=>f.type==='signature'),'Add at least one signature field').refine(fs=>new Set(fs.map(f=>f.id)).size===fs.length,'Field IDs must be unique').refine(fs=>!fs.some((a,i)=>fs.slice(i+1).some(b=>a.page===b.page&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)),'Fields must not overlap');
export type NdaField=z.infer<typeof ndaFieldSchema>;
export type NdaLayout={fields:NdaField[];sha256:string;pages:number;revision:string};
export function parseNdaLayout(raw:unknown):NdaLayout {
 return z.object({fields:ndaFieldsSchema,sha256:z.string().regex(/^[a-f0-9]{64}$/),pages:z.number().int().min(1).max(50),revision:z.string().uuid()}).strict().refine(v=>v.fields.every(f=>f.page<=v.pages)).parse(raw);
}
export function valuesForFields(fields:NdaField[],name:string,initials:string,completed:string[],stamp:Date) {
 const legalName=z.string().trim().min(2).max(100).regex(/^[^\r\n\t]+$/).parse(name);
 const shortName=fields.some(f=>f.type==='initials')?z.string().trim().min(1).max(12).regex(/^[^\r\n\t]+$/).parse(initials):'';
 if(fields.some(f=>!completed.includes(f.id))||completed.some(id=>!fields.some(f=>f.id===id)))throw Error('Complete every field before signing');
 return Object.fromEntries(fields.map(f=>[f.id,f.type==='date'?stamp.toISOString().slice(0,10):f.type==='initials'?shortName:legalName]));
}
