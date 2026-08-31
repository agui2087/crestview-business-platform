import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedDocumentTypes, deleteDocument, findOwnedDocument, getDocumentStorage, maxDocumentBytes, ownerFolder, ownerKey, recordActivity, safeName, updateDocument, validCategory } from "@/lib/document-vault";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function owned(context: Context) {
  const user = await getChatGPTUser(); if (!user?.email) return null;
  const owner = ownerKey(user.email); const { id } = await context.params;
  const document = await findOwnedDocument(owner, id); return document ? { owner, document } : null;
}

export async function GET(_: Request, context: Context) {
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    const result = await getDocumentStorage().download(match.document.storageKey); if (result.error) return Response.json({ error: "File not found." }, { status: 404 });
    await recordActivity(match.owner, match.document.id, "downloaded", match.document.originalName);
    return new Response(result.data, { headers: { "Content-Type": match.document.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(match.document.originalName)}`, "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Secure document storage is temporarily unavailable." }, { status: 503 }); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    const body = await request.json() as { originalName?: string; category?: string; dealName?: string; fiscalYear?: string };
    const nextName = body.originalName ? safeName(body.originalName) : match.document.originalName;
    await updateDocument(match.document.id, { originalName: nextName, category: validCategory(body.category ?? match.document.category), dealName: body.dealName === undefined ? match.document.dealName : safeName(body.dealName).slice(0, 100) || null, fiscalYear: body.fiscalYear === undefined ? match.document.fiscalYear : body.fiscalYear.replace(/[^0-9]/g, "").slice(0, 4) || null });
    await recordActivity(match.owner, match.document.id, "updated", nextName); return Response.json({ ok: true });
  } catch { return Response.json({ error: "Document could not be updated." }, { status: 503 }); }
}

export async function PUT(request: Request, context: Context) {
  let nextKey: string | null = null;
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !allowedDocumentTypes.has(file.type) || file.size > maxDocumentBytes) return Response.json({ error: "Choose a supported file up to 10 MB." }, { status: 400 });
    const name = safeName(file.name); nextKey = `${ownerFolder(match.owner)}/${match.document.id}/${crypto.randomUUID()}-${name}`;
    const storage = getDocumentStorage(); const upload = await storage.upload(nextKey, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error;
    await updateDocument(match.document.id, { storageKey: nextKey, originalName: name, contentType: file.type, sizeBytes: file.size });
    await storage.remove([match.document.storageKey]);
    await recordActivity(match.owner, match.document.id, "replaced", name); return Response.json({ ok: true });
  } catch {
    if (nextKey) await getDocumentStorage().remove([nextKey]).catch(() => undefined);
    return Response.json({ error: "Document could not be replaced." }, { status: 503 });
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    const removal = await getDocumentStorage().remove([match.document.storageKey]); if (removal.error) throw removal.error;
    await deleteDocument(match.document.id); await recordActivity(match.owner, null, "deleted", match.document.originalName); return Response.json({ ok: true });
  } catch { return Response.json({ error: "Document could not be deleted." }, { status: 503 }); }
}
