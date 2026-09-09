import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { maxVaultDocumentBytes } from "@/lib/document-security";

export const documentCategories = ["Financials", "Tax returns", "Bank statements", "Debt", "Legal", "Employees", "Customers", "Assets", "Closing", "Operations", "NDA", "Other"] as const;
export const maxDocumentBytes = maxVaultDocumentBytes;
export const vaultBucket = "vault-files";
export const allowedDocumentTypes = new Set([
  "application/pdf", "text/csv", "text/plain", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png",
]);

export type VaultDocument = {
  id: string; ownerId: string; opportunityId: string | null; storageKey: string;
  originalName: string; contentType: string; sizeBytes: number; category: string;
  dealName: string | null; fiscalYear: string | null; createdAt: string; updatedAt: string;
};

type VaultActivity = { id: string; documentId: string | null; action: string; documentName: string; createdAt: string };

export function ownerFolder(owner: string) { return createHash("sha256").update(owner).digest("hex"); }
export function safeName(value: string) { return value.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "document"; }
export function validCategory(value: string) { return documentCategories.includes(value as typeof documentCategories[number]) ? value : "Other"; }

function mapDocument(row: Record<string, unknown>): VaultDocument {
  return {
    id: String(row.id), ownerId: String(row.owner_id), opportunityId: row.opportunity_id ? String(row.opportunity_id) : null,
    storageKey: String(row.storage_key), originalName: String(row.original_name), contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes), category: String(row.category), dealName: row.deal_name ? String(row.deal_name) : null,
    fiscalYear: row.fiscal_year ? String(row.fiscal_year) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export async function recordActivity(ownerId: string, documentId: string | null, action: string, name: string) {
  const { error } = await createSupabaseAdminClient().from("vault_document_activity").insert({ owner_id: ownerId, owner_key: "uuid-owned", document_id: documentId, action, document_name: name });
  if (error) throw error;
}

export async function findOwnedDocument(ownerId: string, id: string) {
  const { data, error } = await createSupabaseAdminClient().from("vault_documents").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  return data ? mapDocument(data) : null;
}

export async function listVault(ownerId: string) {
  const supabase = createSupabaseAdminClient();
  const [filesResult, activityResult] = await Promise.all([
    supabase.from("vault_documents").select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false }),
    supabase.from("vault_document_activity").select("id,document_id,action,document_name,created_at").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(30),
  ]);
  if (filesResult.error) throw filesResult.error;
  if (activityResult.error) throw activityResult.error;
  const activity: VaultActivity[] = (activityResult.data ?? []).map((row) => ({ id: row.id, documentId: row.document_id, action: row.action, documentName: row.document_name, createdAt: row.created_at }));
  return { files: (filesResult.data ?? []).map(mapDocument), activity };
}

export async function insertDocument(document: Omit<VaultDocument, "createdAt" | "updatedAt">) {
  const { error } = await createSupabaseAdminClient().from("vault_documents").insert({
    id: document.id, owner_id: document.ownerId, owner_key: "uuid-owned", opportunity_id: document.opportunityId, storage_key: document.storageKey,
    original_name: document.originalName, content_type: document.contentType, size_bytes: document.sizeBytes,
    category: document.category, deal_name: document.dealName, fiscal_year: document.fiscalYear,
  });
  if (error) throw error;
}

export async function updateDocument(ownerId: string, id: string, values: Partial<Omit<VaultDocument, "id" | "ownerId" | "createdAt">>) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const keys: Record<string, string> = { opportunityId: "opportunity_id", storageKey: "storage_key", originalName: "original_name", contentType: "content_type", sizeBytes: "size_bytes", category: "category", dealName: "deal_name", fiscalYear: "fiscal_year" };
  for (const [key, value] of Object.entries(values)) payload[keys[key] ?? key] = value;
  const { error } = await createSupabaseAdminClient().from("vault_documents").update(payload).eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function deleteDocument(ownerId: string, id: string) {
  const { error } = await createSupabaseAdminClient().from("vault_documents").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function reserveDocumentUpload(ownerId: string, scope: "vault" | "deal_room" | "listing_nda", resourceId: string | null, sizeBytes: number) {
  const { data, error } = await createSupabaseAdminClient().rpc("reserve_document_upload", {
    p_user_id: ownerId, p_scope: scope, p_resource_id: resourceId, p_size_bytes: sizeBytes,
  });
  if (error) throw error;
  return String(data);
}

export async function finishDocumentUpload(reservationId: string, status: "committed" | "rejected") {
  const { error } = await createSupabaseAdminClient().rpc("finish_document_upload", {
    p_reservation_id: reservationId, p_status: status,
  });
  if (error) throw error;
}

export function getDocumentStorage() { return createSupabaseAdminClient().storage.from(vaultBucket); }

// Future extraction work is intentionally disabled until API billing and a user-review flow are approved.
export const financialAutofillEnabled = false;
export async function queueFinancialAutofill() { throw new Error("Financial autofill is not enabled."); }
