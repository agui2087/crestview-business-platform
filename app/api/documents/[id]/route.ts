import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedDocumentTypes, findOwnedDocument, getDb, getDocumentStorage, maxDocumentBytes, ownerKey, recordActivity, safeName, validCategory, documents } from "@/lib/document-vault";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function owned(context: Context) {
  const user = await getChatGPTUser(); if (!user?.email) return null;
  const owner = ownerKey(user.email); const { id } = await context.params;
  const document = await findOwnedDocument(owner, id); return document ? { user, owner, document } : null;
}

export async function GET(_: Request, context: Context) {
  const match = await owned(context); if (!match) return Response.json({ error:"Document not found." }, { status:404 });
  const object = await (await getDocumentStorage()).get(match.document.storageKey); if (!object) return Response.json({ error:"File not found." }, { status:404 });
  await recordActivity(match.owner, match.document.id, "downloaded", match.document.originalName);
  return new Response(object.body, { headers:{ "Content-Type":match.document.contentType, "Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(match.document.originalName)}`, "Cache-Control":"private, no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const match = await owned(context); if (!match) return Response.json({ error:"Document not found." }, { status:404 });
  const body = await request.json() as { originalName?:string; category?:string; dealName?:string; fiscalYear?:string };
  const nextName = body.originalName ? safeName(body.originalName) : match.document.originalName;
  await (await getDb()).update(documents).set({ originalName:nextName, category:validCategory(body.category ?? match.document.category), dealName:body.dealName === undefined ? match.document.dealName : safeName(body.dealName).slice(0,100) || null, fiscalYear:body.fiscalYear === undefined ? match.document.fiscalYear : body.fiscalYear.replace(/[^0-9]/g,"").slice(0,4) || null, updatedAt:new Date().toISOString() }).where(eq(documents.id, match.document.id));
  await recordActivity(match.owner, match.document.id, "updated", nextName); return Response.json({ ok:true });
}

export async function PUT(request: Request, context: Context) {
  const match = await owned(context); if (!match) return Response.json({ error:"Document not found." }, { status:404 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || !allowedDocumentTypes.has(file.type) || file.size > maxDocumentBytes) return Response.json({ error:"Choose a supported file up to 10 MB." }, { status:400 });
  const name=safeName(file.name); const key=`${encodeURIComponent(match.owner)}/${match.document.id}/${name}`;
  await (await getDocumentStorage()).put(key,file.stream(),{httpMetadata:{contentType:file.type}});
  await (await getDocumentStorage()).delete(match.document.storageKey);
  await (await getDb()).update(documents).set({ storageKey:key, originalName:name, contentType:file.type, sizeBytes:file.size, updatedAt:new Date().toISOString() }).where(eq(documents.id,match.document.id));
  await recordActivity(match.owner,match.document.id,"replaced",name); return Response.json({ok:true});
}

export async function DELETE(_: Request, context: Context) {
  const match = await owned(context); if (!match) return Response.json({ error:"Document not found." }, { status:404 });
  await (await getDocumentStorage()).delete(match.document.storageKey); await (await getDb()).delete(documents).where(eq(documents.id,match.document.id));
  await recordActivity(match.owner,null,"deleted",match.document.originalName); return Response.json({ok:true});
}
