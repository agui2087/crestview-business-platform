import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedDocumentTypes, documentCategories, finishDocumentUpload, getDocumentStorage, insertDocument, listVault, maxDocumentBytes, ownerFolder, recordActivity, reserveDocumentUpload, safeName, validCategory } from "@/lib/document-vault";
import { inspectDocumentSafety, validateUploadedDocument } from "@/lib/document-security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user?.id) return Response.json({ error: "Sign in on Crestview to access your documents." }, { status: 401 });
    const { files, activity } = await listVault(user.id);
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
  let reservationId: string | null = null;
  try {
    const user = await getChatGPTUser();
    if (!user?.id) return Response.json({ error: "Sign in on Crestview to upload documents." }, { status: 401 });
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    if (!allowedDocumentTypes.has(file.type)) return Response.json({ error: "That file type is not supported." }, { status: 400 });
    if (file.size > maxDocumentBytes) return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 400 });
    if (!(await validateUploadedDocument(file))) return Response.json({ error: "The file contents do not match the selected file type." }, { status: 400 });
    const safety = await inspectDocumentSafety(file);
    if (!safety.safe) return Response.json({ error: safety.reason }, { status: 400 });
    const owner = user.id; const id = crypto.randomUUID(); const name = safeName(file.name);
    reservationId = await reserveDocumentUpload(owner, "vault", null, file.size);
    uploadedKey = `${ownerFolder(owner)}/${id}/${name}`;
    const storage = getDocumentStorage();
    const upload = await storage.upload(uploadedKey, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    await insertDocument({ id, ownerId: owner, opportunityId: null, storageKey: uploadedKey, originalName: name, contentType: file.type, sizeBytes: file.size, category: validCategory(String(form.get("category") ?? "Other")), dealName: safeName(String(form.get("dealName") ?? "")).slice(0, 100) || null, fiscalYear: String(form.get("fiscalYear") ?? "").replace(/[^0-9]/g, "").slice(0, 4) || null });
    await recordActivity(owner, id, "uploaded", name);
    await finishDocumentUpload(reservationId, "committed");
    return Response.json({ ok: true, id }, { status: 201 });
  } catch {
    if (uploadedKey) await getDocumentStorage().remove([uploadedKey]).catch(() => undefined);
    if (reservationId) await finishDocumentUpload(reservationId, "rejected").catch(() => undefined);
    return Response.json({ error: "The upload could not be completed. You may have reached the hourly or storage limit." }, { status: 429 });
  }
}
