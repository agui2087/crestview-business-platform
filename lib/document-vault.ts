import { eq, and, desc } from "drizzle-orm";
import { getDb, getDocumentStorage } from "@/db";
import { documentActivity, documents } from "@/db/schema";

export const documentCategories = ["Financials", "Tax returns", "Bank statements", "Debt", "Legal", "Employees", "Customers", "Assets", "Closing", "Operations", "NDA", "Other"] as const;
export const maxDocumentBytes = 10 * 1024 * 1024;
export const allowedDocumentTypes = new Set([
  "application/pdf", "text/csv", "text/plain", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png",
]);

export function ownerKey(email: string) { return email.trim().toLowerCase(); }
export function safeName(value: string) { return value.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "document"; }
export function validCategory(value: string) { return documentCategories.includes(value as typeof documentCategories[number]) ? value : "Other"; }

export async function recordActivity(owner: string, documentId: string | null, action: string, name: string) {
  await (await getDb()).insert(documentActivity).values({ id: crypto.randomUUID(), documentId, ownerKey: owner, action, documentName: name });
}

export async function findOwnedDocument(owner: string, id: string) {
  return (await getDb()).select().from(documents).where(and(eq(documents.id, id), eq(documents.ownerKey, owner))).get();
}

export async function listVault(owner: string) {
  const db = await getDb();
  const [files, activity] = await Promise.all([
    db.select().from(documents).where(eq(documents.ownerKey, owner)).orderBy(desc(documents.updatedAt)).all(),
    db.select().from(documentActivity).where(eq(documentActivity.ownerKey, owner)).orderBy(desc(documentActivity.createdAt)).limit(30).all(),
  ]);
  return { files, activity };
}

// Future extraction work is intentionally disabled until API billing and a user-review flow are approved.
export const financialAutofillEnabled = false;
export async function queueFinancialAutofill() {
  if (!financialAutofillEnabled) throw new Error("Financial autofill is not enabled.");
}

export { getDb, getDocumentStorage, documents };
