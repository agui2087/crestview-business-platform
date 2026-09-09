import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const outputRoot = resolve(process.argv[2] ?? "work/storage-backup");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const buckets = (process.env.CRESTVIEW_BACKUP_BUCKETS ?? "vault-files,deal-files")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!supabaseUrl || !serviceKey) throw new Error("Supabase backup credentials are not configured.");
if (!buckets.length) throw new Error("At least one storage bucket is required.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const manifest = { createdAt: new Date().toISOString(), buckets: [], files: [] };

function safeObjectPath(value) {
  const segments = value.split("/");
  if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Storage returned an unsafe object path.");
  }
  return segments;
}

async function listObjects(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1_000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1_000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) files.push(path);
      else files.push(...await listObjects(bucket, path));
    }
    if ((data?.length ?? 0) < 1_000) break;
  }
  return files;
}

await mkdir(outputRoot, { recursive: true });
for (const bucket of buckets) {
  const objectPaths = await listObjects(bucket);
  manifest.buckets.push({ name: bucket, objectCount: objectPaths.length });
  for (const objectPath of objectPaths) {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error) throw error;
    const bytes = Buffer.from(await data.arrayBuffer());
    const target = join(outputRoot, bucket, ...safeObjectPath(objectPath));
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, bytes);
    manifest.files.push({
      bucket,
      path: objectPath,
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(`Backed up ${manifest.files.length} private storage objects across ${manifest.buckets.length} buckets.`);
