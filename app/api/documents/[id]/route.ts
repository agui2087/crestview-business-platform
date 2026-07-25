import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { documents } from "@/db/schema";

export const runtime = "edge";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getChatGPTUser();
    if (!user) return new Response("Sign in required.", { status: 401 });
    const { env } = await import("cloudflare:workers");
    if (!env.DOCUMENTS) return new Response("File storage is unavailable.", { status: 503 });
    const { id } = await params;
    const [row] = await (await getDb()).select().from(documents).where(and(eq(documents.id, id), eq(documents.ownerKey, user.email))).limit(1);
    if (!row) return new Response("Document not found.", { status: 404 });
    const object = await env.DOCUMENTS.get(row.storageKey);
    if (!object) return new Response("Document not found.", { status: 404 });
    const filename = row.originalName.replace(/["\r\n]/g, "");
    return new Response(object.body, {
      headers: {
        "Content-Type": row.contentType,
        "Content-Length": String(row.sizeBytes),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("The document could not be downloaded.", { status: 500 });
  }
}
