import {PDFDocument,StandardFonts,degrees,rgb,PDFName,PDFDict} from 'pdf-lib';
import {createHash} from 'node:crypto';
import {parseNdaLayout,fieldRole,type NdaLayout,type SignerRole} from './nda-fields.ts';
import {parseSignatureAppearance,type SignatureAppearance} from './nda-signature.ts';
export const pdfHash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export async function inspectSigningPdf(bytes:Uint8Array) {
 if(bytes.length>3_500_000)throw Error('PDF exceeds the signing size limit');
 const pdf=await PDFDocument.load(bytes,{updateMetadata:false});
 if(pdf.getPageCount()<1||pdf.getPageCount()>50)throw Error('Visual signing supports 1 to 50 pages');
 // Existing cryptographic signatures and interactive forms must not silently
 // become invalid or change appearances when a completed copy is produced.
 if(pdf.catalog.has(PDFName.of('AcroForm'))||pdf.catalog.has(PDFName.of('Perms')))throw Error('Use a flat, unsigned PDF without interactive form fields');
 for(const page of pdf.getPages()) {
  for(const annotation of page.node.Annots()?.asArray()??[]) {
   if(pdf.context.lookup(annotation,PDFDict).get(PDFName.of('Subtype'))?.toString()==='/Widget')throw Error('Use a flat, unsigned PDF without interactive form fields');
  }
  const b=page.getCropBox(),m=page.getMediaBox(),r=((page.getRotation().angle%360)+360)%360;
  // PDF viewers clip CropBox to MediaBox. Reject a mismatched visible area so
  // normalized browser field positions cannot shift in the completed file.
  if(![b.x,b.y,b.width,b.height,m.x,m.y,m.width,m.height].every(Number.isFinite)||![0,90,180,270].includes(r)||b.width<100||b.height<100||b.width>5000||b.height>5000||b.x<m.x||b.y<m.y||b.x+b.width>m.x+m.width||b.y+b.height>m.y+m.height)throw Error('Unsupported PDF page geometry. Export a flat PDF with its crop inside the page boundaries.');
 }
 return {pdf,pages:pdf.getPageCount(),sha256:pdfHash(bytes)};
}
export function pdfPoint(x:number,y:number,box:{x:number;y:number;width:number;height:number},rotation:number) {
 const r=((rotation%360)+360)%360;
 if(r===90)return {x:box.x+y,y:box.y+x};
 if(r===180)return {x:box.x+box.width-x,y:box.y+y};
 if(r===270)return {x:box.x+box.width-y,y:box.y+box.height-x};
 return {x:box.x+x,y:box.y+box.height-y};
}
export async function completeSigningPdf(bytes:Uint8Array,rawLayout:NdaLayout,values:Record<string,string>,appearances:Partial<Record<SignerRole,SignatureAppearance>>={},partial=false) {
 const layout=parseNdaLayout(rawLayout),{pdf,pages,sha256}=await inspectSigningPdf(bytes);
 if(sha256!==layout.sha256||pages!==layout.pages)throw Error('The PDF changed. Nothing was signed.');
 const regular=await pdf.embedFont(StandardFonts.Helvetica),signature=await pdf.embedFont(StandardFonts.TimesRomanItalic);
 for(const field of layout.fields) {
  const page=pdf.getPage(field.page-1),box=page.getCropBox(),rotation=((page.getRotation().angle%360)+360)%360;
  const width=rotation%180?box.height:box.width,height=rotation%180?box.width:box.height;
  const text=values[field.id];if(partial&&text===undefined)continue;if(field.required===false&&text==='')continue;if(!text||/[\r\n\t]/.test(text)||text.length>100)throw Error('Invalid signing value');
  const appearance=parseSignatureAppearance(appearances[fieldRole(field)]??{mode:'typed'});
  if(field.type==='signature'&&appearance.mode==='drawn') {
   const scale=Math.min(field.width*width/600,field.height*height/180),w=600*scale,h=180*scale;
   for(const stroke of appearance.strokes)for(let i=1;i<stroke.length;i++) {
    const at=(p:number[])=>pdfPoint(field.x*width+(field.width*width-w)/2+p[0]*w,field.y*height+(field.height*height-h)/2+p[1]*h,box,rotation);
    page.drawLine({start:at(stroke[i-1]),end:at(stroke[i]),thickness:1.25,color:rgb(.05,.12,.09)});
   }
   continue;
  }
  if(field.type==='signature'&&appearance.mode==='uploaded') {
   const isPng=appearance.image.startsWith('data:image/png;'),data=Buffer.from(appearance.image.split(',')[1],'base64');
   if(data.length>160000)throw Error('Signature image exceeds 160 KB');
   if(isPng&&(data.length<24||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||data.readUInt32BE(16)>2000||data.readUInt32BE(20)>2000||data.readUInt32BE(16)<1||data.readUInt32BE(20)<1))throw Error('Use a PNG or JPEG signature image at most 2000 pixels per side');
   const image=isPng?await pdf.embedPng(data):await pdf.embedJpg(data);
   if(image.width>2000||image.height>2000||image.width<1||image.height<1)throw Error('Signature image dimensions are unsupported');
   const scale=Math.min(field.width*width/image.width,field.height*height/image.height),w=image.width*scale,h=image.height*scale;
   const at=pdfPoint(field.x*width+(field.width*width-w)/2,field.y*height+(field.height*height+h)/2,box,rotation);
   page.drawImage(image,{...at,width:w,height:h,rotate:degrees(rotation)});continue;
  }
  const font=field.type==='signature'?signature:regular;
  let measured:number;try{measured=font.widthOfTextAtSize(text,1);}catch{throw Error('This name contains characters not supported by the PDF font. Ask the broker for an alternative signing method.');}
  const size=Math.min(field.type==='signature'?24:14,(field.height*height-6)*.75,(field.width*width-8)/measured);
  if(size<7)throw Error('A field is too small for your name. Ask the broker to prepare a larger field.');
  const point=pdfPoint(field.x*width+4,field.y*height+field.height*height/2+size*.32,box,rotation);
  page.drawText(text,{...point,size,font,rotate:degrees(rotation),color:rgb(.05,.12,.09)});
 }
 const output=await pdf.save({useObjectStreams:false,updateFieldAppearances:false});
 if(output.length>10_000_000)throw Error('Completed PDF exceeds the size limit');
 return output;
}
