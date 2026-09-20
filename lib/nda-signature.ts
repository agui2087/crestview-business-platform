import {z} from 'zod';
const point=z.tuple([z.number().min(0).max(1),z.number().min(0).max(1)]);
export const signatureAppearanceSchema=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('typed')}).strict(),
 z.object({mode:z.literal('drawn'),strokes:z.array(z.array(point).min(2).max(500)).min(1).max(30)}).strict(),
 z.object({mode:z.literal('uploaded'),image:z.string().max(220000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/)}).strict(),
]);
export type SignatureAppearance=z.infer<typeof signatureAppearanceSchema>;
export function parseSignatureAppearance(raw:unknown):SignatureAppearance {
 const value=signatureAppearanceSchema.parse(raw);
 if(value.mode==='drawn') {
  const points=value.strokes.flat();
  if(points.length>3000||Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))<.03||Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))<.01)throw Error('Draw a visible signature');
 }
 return value;
}
