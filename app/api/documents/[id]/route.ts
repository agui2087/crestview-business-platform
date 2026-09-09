import { getChatGPTUser } from "@/app/chatgpt-auth";
import { allowedDocumentTypes, deleteDocument, findOwnedDocument, finishDocumentUpload, getDocumentStorage, maxDocumentBytes, ownerFolder, recordActivity, recordSecurityEvent, reserveDocumentUpload, safeName, updateDocument, validCategory } from "@/lib/document-vault";
import { scanUploadedDocument, securityStatusForScan, validateUploadedDocument } from "@/lib/document-security";
import { createRequestId, logOperationalEvent, reportOperationalEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function owned(context: Context) {
  const user = await getChatGPTUser(); if (!user?.id) return null;
  const owner = user.id; const { id } = await context.params;
  const document = await findOwnedDocument(owner, id); return document ? { owner, document } : null;
}

export async function GET(request: Request, context: Context) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) ?? createRequestId();
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    if (!["basic_validated", "malware_scanned"].includes(match.document.securityStatus)) return Response.json({ error: "This document is still being checked and cannot be downloaded yet." }, { status: 423 });
    const result = await getDocumentStorage().download(match.document.storageKey); if (result.error) return Response.json({ error: "File not found." }, { status: 404 });
    await recordActivity(match.owner, match.document.id, "downloaded", match.document.originalName);
    return new Response(result.data, { headers: { "Content-Type": match.document.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(match.document.originalName)}`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    await reportOperationalEvent({ event: "document.download_failed", level: "error", requestId, route: "/api/documents/[id]", error });
    return Response.json({ error: "Secure document storage is temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) ?? createRequestId();
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    const body = await request.json() as { originalName?: string; category?: string; dealName?: string; fiscalYear?: string };
    const nextName = body.originalName ? safeName(body.originalName) : match.document.originalName;
    await updateDocument(match.owner, match.document.id, { originalName: nextName, category: validCategory(body.category ?? match.document.category), dealName: body.dealName === undefined ? match.document.dealName : safeName(body.dealName).slice(0, 100) || null, fiscalYear: body.fiscalYear === undefined ? match.document.fiscalYear : body.fiscalYear.replace(/[^0-9]/g, "").slice(0, 4) || null });
    await recordActivity(match.owner, match.document.id, "updated", nextName); return Response.json({ ok: true });
  } catch (error) {
    await reportOperationalEvent({ event: "document.metadata_update_failed", level: "error", requestId, route: "/api/documents/[id]", error });
    return Response.json({ error: "Document could not be updated." }, { status: 503 });
  }
}

export async function PUT(request: Request, context: Context) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) ?? createRequestId();
  let nextKey: string | null = null;
  let reservationId: string | null = null;
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !allowedDocumentTypes.has(file.type) || file.size > maxDocumentBytes) return Response.json({ error: "Choose a supported file up to 10 MB." }, { status: 400 });
    if (!(await validateUploadedDocument(file))) return Response.json({ error: "The file contents do not match the selected file type." }, { status: 400 });
    const scan = await scanUploadedDocument(file);
    if (scan.status === "blocked") {
      logOperationalEvent({ event: "document.scan_blocked", level: "warn", requestId, route: "/api/documents/[id]", details: { provider: scan.provider, sha256: scan.sha256 } });
      await recordSecurityEvent({ documentId: match.document.id, ownerId: match.owner, status: "blocked", provider: scan.provider, sha256: scan.sha256, reason: scan.reason });
      return Response.json({ error: scan.reason }, { status: 400 });
    }
    if (scan.status === "unavailable") {
      await recordSecurityEvent({ documentId: match.document.id, ownerId: match.owner, status: "scan_error", provider: scan.provider, sha256: scan.sha256, reason: scan.reason });
      await reportOperationalEvent({ event: "document.scan_unavailable", level: "error", requestId, route: "/api/documents/[id]", message: scan.reason ?? undefined, details: { provider: scan.provider, sha256: scan.sha256 } });
      return Response.json({ error: `${scan.reason} The existing file was not changed.` }, { status: 503 });
    }
    reservationId = await reserveDocumentUpload(match.owner, "vault", match.document.id, file.size);
    const name = safeName(file.name); nextKey = `${ownerFolder(match.owner)}/${match.document.id}/${crypto.randomUUID()}-${name}`;
    const storage = getDocumentStorage(); const upload = await storage.upload(nextKey, file, { contentType: file.type, upsert: false }); if (upload.error) throw upload.error;
    await recordSecurityEvent({ documentId: match.document.id, ownerId: match.owner, status: securityStatusForScan(scan), provider: scan.provider, sha256: scan.sha256 });
    await updateDocument(match.owner, match.document.id, { storageKey: nextKey, originalName: name, contentType: file.type, sizeBytes: file.size, securityStatus: securityStatusForScan(scan), scanProvider: scan.provider, scanCompletedAt: new Date().toISOString(), scanSha256: scan.sha256, scanFailureReason: null });
    await storage.remove([match.document.storageKey]);
    await recordActivity(match.owner, match.document.id, "replaced", name); await finishDocumentUpload(reservationId, "committed"); return Response.json({ ok: true });
  } catch (error) {
    if (nextKey) await getDocumentStorage().remove([nextKey]).catch(() => undefined);
    if (reservationId) await finishDocumentUpload(reservationId, "rejected").catch(() => undefined);
    const quotaFailure = error instanceof Error && /limit|quota|too many|exceed/i.test(error.message);
    await reportOperationalEvent({ event: "document.replace_failed", level: "error", requestId, route: "/api/documents/[id]", error, details: { quotaFailure } });
    return Response.json({ error: quotaFailure ? "The upload limit has been reached. Try again later or remove unused files." : "Document could not be replaced. The existing file was not changed." }, { status: quotaFailure ? 429 : 503 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) ?? createRequestId();
  try {
    const match = await owned(context); if (!match) return Response.json({ error: "Document not found." }, { status: 404 });
    await deleteDocument(match.owner, match.document.id);
    const removal = await getDocumentStorage().remove([match.document.storageKey]);
    if (removal.error) await reportOperationalEvent({ event: "document.storage_cleanup_failed", level: "error", requestId, route: "/api/documents/[id]", error: removal.error });
    await recordActivity(match.owner, null, "deleted", match.document.originalName);
    return Response.json({ ok: true, cleanupPending: Boolean(removal.error) });
  } catch (error) {
    await reportOperationalEvent({ event: "document.delete_failed", level: "error", requestId, route: "/api/documents/[id]", error });
    return Response.json({ error: "Document could not be deleted." }, { status: 503 });
  }
}
