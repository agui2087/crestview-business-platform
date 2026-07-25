import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { documents } from "@/db/schema";

export const runtime = "edge";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const rows = await (await getDb()).select().from(documents).where(eq(documents.ownerKey, user.email)).orderBy(desc(documents.createdAt)).limit(100);
    return Response.json({ documents: rows });
  } catch {
    return Response.json({ documents: [], error: "Document storage is still initializing." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { env } = await import("cloudflare:workers");
    if (!env.DOCUMENTS) return Response.json({ error: "File storage is not connected." }, { status: 503 });
    const formData = await request.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") ?? "Other").slice(0, 80);
    const opportunityId = String(formData.get("opportunityId") ?? "").slice(0, 120) || null;
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ error: "That file type is not supported." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 400 });

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const ownerFolder = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.email));
    const ownerHash = Array.from(new Uint8Array(ownerFolder)).slice(0, 12).map((value) => value.toString(16).padStart(2, "0")).join("");
    const storageKey = `${ownerHash}/${id}-${safeName}`;
    await env.DOCUMENTS.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name },
    });
    try {
      const [row] = await (await getDb()).insert(documents).values({
        id,
        ownerKey: user.email,
        storageKey,
        originalName: file.name.slice(0, 240),
        contentType: file.type,
        sizeBytes: file.size,
        category,
        opportunityId,
      }).returning();
      return Response.json({ document: row }, { status: 201 });
    } catch (error) {
      await env.DOCUMENTS.delete(storageKey);
      throw error;
    }
  } catch {
    return Response.json({ error: "The upload could not be completed. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { env } = await import("cloudflare:workers");
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !env.DOCUMENTS) return Response.json({ error: "Document not found." }, { status: 404 });
    const [row] = await (await getDb()).select().from(documents).where(and(eq(documents.id, id), eq(documents.ownerKey, user.email))).limit(1);
    if (!row) return Response.json({ error: "Document not found." }, { status: 404 });
    await env.DOCUMENTS.delete(row.storageKey);
    await (await getDb()).delete(documents).where(and(eq(documents.id, id), eq(documents.ownerKey, user.email)));
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "The document could not be deleted." }, { status: 500 });
  }
}
