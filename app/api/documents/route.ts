import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedDocumentTypes, documentCategories, getDb, getDocumentStorage, listVault, maxDocumentBytes, ownerKey, recordActivity, safeName, validCategory, documents } from "@/lib/document-vault";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user?.email) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { files, activity } = await listVault(ownerKey(user.email));
  return Response.json({
    documents: files.map((item) => ({ id:item.id, originalName:item.originalName, contentType:item.contentType, sizeBytes:item.sizeBytes, category:item.category, dealName:item.dealName, fiscalYear:item.fiscalYear, createdAt:item.createdAt, updatedAt:item.updatedAt })),
    activity,
    categories: documentCategories,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user?.email) return Response.json({ error: "Sign in required." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (!allowedDocumentTypes.has(file.type)) return Response.json({ error: "That file type is not supported." }, { status: 400 });
  if (file.size > maxDocumentBytes) return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 400 });
  const owner = ownerKey(user.email); const id = crypto.randomUUID(); const name = safeName(file.name);
  const storageKey = `${encodeURIComponent(owner)}/${id}/${name}`;
  await (await getDocumentStorage()).put(storageKey, file.stream(), { httpMetadata: { contentType: file.type } });
  try {
    await (await getDb()).insert(documents).values({ id, ownerKey:owner, opportunityId:null, storageKey, originalName:name, contentType:file.type, sizeBytes:file.size, category:validCategory(String(form.get("category") ?? "Other")), dealName:safeName(String(form.get("dealName") ?? "")).slice(0, 100) || null, fiscalYear:String(form.get("fiscalYear") ?? "").replace(/[^0-9]/g, "").slice(0, 4) || null });
    await recordActivity(owner, id, "uploaded", name);
  } catch (error) { await (await getDocumentStorage()).delete(storageKey); throw error; }
  return Response.json({ ok:true, id }, { status:201 });
}
