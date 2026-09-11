// Child process: bounded memory/time by the calling worker. Never writes document bytes.
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const chunks=[];let size=0;
for await(const chunk of process.stdin){size+=chunk.length;if(size>10485760)process.exit(2);chunks.push(chunk);}
try{
  const task=getDocument({data:new Uint8Array(Buffer.concat(chunks)),isEvalSupported:false,disableFontFace:true,useSystemFonts:false});
  const pdf=await task.promise;
  if(pdf.numPages>30)throw new Error('page_limit');
  const pages=[];
  for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n);
    const content=await page.getTextContent();
    const text=content.items.map(item=>'str' in item?item.str:'').join(' ');
    if(text.length>12000)throw new Error('page_too_large');
    // A textless page may contain material scanned information; do not silently skip it.
    if(!text.trim())throw new Error('ocr_required');
    pages.push(text);page.cleanup();
  }
  await task.destroy();process.stdout.write(JSON.stringify({pages}));
}catch(error){process.stdout.write(JSON.stringify({error:['page_limit','page_too_large','ocr_required'].includes(error.message)?error.message:'unreadable_pdf'}));}
