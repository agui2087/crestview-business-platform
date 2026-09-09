import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedDocumentTypes, deleteDocument, documentCategories, finishDocumentUpload, getDocumentStorage, insertDocument, listVault, maxDocumentBytes, ownerFolder, recordActivity, recordSecurityEvent, reserveDocumentUpload, safeName, validCategory } from "@/lib/document-vault";
import { scanUploadedDocument, securityStatusForScan, validateUploadedDocument } from "@/lib/document-security";
import { createRequestId, logOperationalEvent, reportOperationalEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) ?? createRequestId();
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
      securityStatus: file.securityStatus,
      scanProvider: file.scanProvider,
      scanCompletedAt: file.scanCompletedAt,
    })), activity, categories: documentCategories }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await reportOperationalEvent({ event: "document.list_failed", level: "error", requestId, route: "/api/documents", error });
    return Response.json({ error: "Secure document storage is temporarily unavailable. No file was uploaded." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) ?? createRequestId();
  let uploadedKey: string | null = null;
  let reservationId: string | null = null;
  let insertedDocumentId: string | null = null;
  let ownerId: string | null = null;
  try {
    const user = await getChatGPTUser();
    if (!user?.id) return Response.json({ error: "Sign in on Crestview to upload documents." }, { status: 401 });
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    if (!allowedDocumentTypes.has(file.type)) return Response.json({ error: "That file type is not supported." }, { status: 400 });
    if (file.size > maxDocumentBytes) return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 400 });
    if (!(await validateUploadedDocument(file))) return Response.json({ error: "The file contents do not match the selected file type." }, { status: 400 });
    const scan = await scanUploadedDocument(file);
    if (scan.status === "blocked") {
      logOperationalEvent({ event: "document.scan_blocked", level: "warn", requestId, route: "/api/documents", details: { provider: scan.provider, sha256: scan.sha256 } });
      await recordSecurityEvent({ documentId: null, ownerId: user.id, status: "blocked", provider: scan.provider, sha256: scan.sha256, reason: scan.reason });
      return Response.json({ error: scan.reason }, { status: 400 });
    }
    if (scan.status === "unavailable") {
      await recordSecurityEvent({ documentId: null, ownerId: user.id, status: "scan_error", provider: scan.provider, sha256: scan.sha256, reason: scan.reason });
      await reportOperationalEvent({ event: "document.scan_unavailable", level: "error", requestId, route: "/api/documents", message: scan.reason ?? undefined, details: { provider: scan.provider, sha256: scan.sha256 } });
      return Response.json({ error: `${scan.reason} The file was not saved.` }, { status: 503 });
    }
    const owner = user.id; ownerId = owner; const id = crypto.randomUUID(); const name = safeName(file.name);
    reservationId = await reserveDocumentUpload(owner, "vault", null, file.size);
    uploadedKey = `${ownerFolder(owner)}/${id}/${name}`;
    const storage = getDocumentStorage();
    const upload = await storage.upload(uploadedKey, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    await recordSecurityEvent({ documentId: id, ownerId: owner, status: securityStatusForScan(scan), provider: scan.provider, sha256: scan.sha256 });
    await insertDocument({ id, ownerId: owner, opportunityId: null, storageKey: uploadedKey, originalName: name, contentType: file.type, sizeBytes: file.size, category: validCategory(String(form.get("category") ?? "Other")), dealName: safeName(String(form.get("dealName") ?? "")).slice(0, 100) || null, fiscalYear: String(form.get("fiscalYear") ?? "").replace(/[^0-9]/g, "").slice(0, 4) || null, securityStatus: securityStatusForScan(scan), scanProvider: scan.provider, scanCompletedAt: new Date().toISOString(), scanSha256: scan.sha256 });
    insertedDocumentId = id;
    await recordActivity(owner, id, "uploaded", name);
    await finishDocumentUpload(reservationId, "committed");
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (uploadedKey) await getDocumentStorage().remove([uploadedKey]).catch(() => undefined);
    if (insertedDocumentId && ownerId) await deleteDocument(ownerId, insertedDocumentId).catch(() => undefined);
    if (reservationId) await finishDocumentUpload(reservationId, "rejected").catch(() => undefined);
    const quotaFailure = error instanceof Error && /limit|quota|too many|exceed/i.test(error.message);
    await reportOperationalEvent({ event: "document.upload_failed", level: "error", requestId, route: "/api/documents", error, details: { quotaFailure } });
    return Response.json({ error: quotaFailure ? "The upload limit has been reached. Try again later or remove unused files." : "The upload could not be completed. Your file was not saved." }, { status: quotaFailure ? 429 : 503 });
  }
}
