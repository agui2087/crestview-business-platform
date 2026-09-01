import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedDocumentTypes, documentCategories, getDocumentStorage, insertDocument, listVault, maxDocumentBytes, ownerFolder, ownerKey, recordActivity, safeName, validCategory } from "@/lib/document-vault";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user?.email) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { files, activity } = await listVault(ownerKey(user.email));
    return Response.json({ documents: files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      category: file.category,
      dealName: file.dealName,
      fiscalYear: file.fiscalYear,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    })), activity, categories: documentCategories }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Secure document storage is temporarily unavailable. No file was uploaded." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let uploadedKey: string | null = null;
  try {
    const user = await getChatGPTUser();
    if (!user?.email) return Response.json({ error: "Sign in required." }, { status: 401 });
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    if (!allowedDocumentTypes.has(file.type)) return Response.json({ error: "That file type is not supported." }, { status: 400 });
    if (file.size > maxDocumentBytes) return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 400 });
    const owner = ownerKey(user.email); const id = crypto.randomUUID(); const name = safeName(file.name);
    uploadedKey = `${ownerFolder(owner)}/${id}/${name}`;
    const storage = getDocumentStorage();
    const upload = await storage.upload(uploadedKey, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    await insertDocument({ id, ownerKey: owner, opportunityId: null, storageKey: uploadedKey, originalName: name, contentType: file.type, sizeBytes: file.size, category: validCategory(String(form.get("category") ?? "Other")), dealName: safeName(String(form.get("dealName") ?? "")).slice(0, 100) || null, fiscalYear: String(form.get("fiscalYear") ?? "").replace(/[^0-9]/g, "").slice(0, 4) || null });
    await recordActivity(owner, id, "uploaded", name);
    return Response.json({ ok: true, id }, { status: 201 });
  } catch {
    if (uploadedKey) await getDocumentStorage().remove([uploadedKey]).catch(() => undefined);
    return Response.json({ error: "Secure document storage is temporarily unavailable. No file was uploaded." }, { status: 503 });
  }
}
