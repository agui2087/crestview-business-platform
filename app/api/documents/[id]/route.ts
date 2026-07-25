import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents } from "@/db/schema";

export const runtime = "edge";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { env } = await import("cloudflare:workers");
    if (!env.DOCUMENTS) return new Response("File storage is unavailable.", { status: 503 });
    const { id } = await params;
    const [row] = await (await getDb()).select().from(documents).where(eq(documents.id, id)).limit(1);
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
