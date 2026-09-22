import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

async function harness() {
  const source = await readFile(new URL("../app/[locale]/dashboard/deals/[id]/documents/[documentId]/file/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const state = { signedIn: true, participant: true, visible: true, storageAllowed: true, mime: "application/pdf", downloads: 0 };
  const filters: unknown[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: "buyer" } : null }, error: null }) },
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => { filters.push([table, key, value]); return q; },
        or: (value: string) => { filters.push([table, "or", value]); return q; },
        in: (key: string, value: unknown) => { filters.push([table, key, value]); return q; },
        maybeSingle: async () => ({ error: null, data: table === "deal_inquiries" ? (state.participant ? { id: "deal" } : null) : state.visible ? { storage_path: "private.pdf", mime_type: state.mime } : null }),
      }; return q;
    },
    storage: { from: () => ({ download: async () => { state.downloads++; return { data: state.storageAllowed ? new Blob(["synthetic document"]) : null, error: null }; } }) },
  };
  const exports: { GET?: (r: Request, c: unknown) => Promise<Response> } = {};
  runInNewContext(code, { exports, Response, URL, require: (name: string) => {
    if (name === "@/lib/i18n") return { isLocale: (v: string) => ["en", "es"].includes(v) };
    if (name === "@/lib/supabase/server") return { isSupabaseConfigured: () => true, createSupabaseServerClient: async () => client };
    throw Error(name);
  } });
  return { state, filters, run: (query = "") => exports.GET!(new Request(`https://example.test/file${query}`), { params: Promise.resolve({ locale: "en", id: "deal", documentId: "doc" }) }) };
}

test("deal file rechecks access on repeated opens and does not redirect or cache bytes", async () => {
  const h = await harness();
  const allowed = await h.run();
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("location"), null);
  assert.match(allowed.headers.get("cache-control")!, /private, no-store/);
  assert.equal(allowed.headers.get("content-type"), "application/pdf");
  assert.equal(await allowed.text(), "synthetic document");
  h.state.visible = false;
  assert.equal((await h.run()).status, 404);
  assert.equal(h.state.downloads, 1);
  const filters = JSON.stringify(h.filters);
  for (const required of ['"inquiry_id","deal"', '"id","doc"', '"is_active",true', '"security_status",["basic_validated","malware_scanned"]']) assert.ok(filters.includes(required));
});
test("deal file denies signed-out users, unrelated participants and storage-policy failures", async () => {
  for (const field of ["signedIn", "participant", "storageAllowed"] as const) {
    const h = await harness(); h.state[field] = false;
    const response = await h.run(); assert.equal(response.status, 404);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});
test("non-PDF files and explicit downloads are attachments, never active inline content", async () => {
  const h = await harness();
  assert.equal((await h.run("?download=1")).headers.get("content-disposition"), 'attachment; filename="private.pdf"');
  h.state.mime = "text/html";
  const response = await h.run();
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="private.pdf"');
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});
