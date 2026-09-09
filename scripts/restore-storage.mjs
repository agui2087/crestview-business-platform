import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const backupRoot = resolve(process.argv[2] ?? "work/storage-backup");
const supabaseUrl = process.env.RESTORE_SUPABASE_URL?.trim();
const serviceKey = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const runLabel = (process.env.GITHUB_RUN_ID ?? Date.now().toString()).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32);

if (!supabaseUrl || !serviceKey) throw new Error("Isolated restore-target credentials are not configured.");
if (supabaseUrl === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Storage restore target must not be the source project.");

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const manifest = JSON.parse(await readFile(join(backupRoot, "manifest.json"), "utf8"));
const restoreBuckets = new Map();

try {
  for (const bucket of manifest.buckets ?? []) {
    const target = `restore-${runLabel}-${bucket.name}`.toLowerCase().slice(0, 63);
    const { error } = await supabase.storage.createBucket(target, { public: false, fileSizeLimit: 20 * 1024 * 1024 });
    if (error) throw error;
    restoreBuckets.set(bucket.name, target);
  }

  for (const file of manifest.files ?? []) {
    const targetBucket = restoreBuckets.get(file.bucket);
    if (!targetBucket) throw new Error(`Restore bucket is missing for ${file.bucket}.`);
    const bytes = await readFile(join(backupRoot, file.bucket, ...String(file.path).split("/")));
    const upload = await supabase.storage.from(targetBucket).upload(file.path, bytes, { upsert: false, contentType: "application/octet-stream" });
    if (upload.error) throw upload.error;
    const restored = await supabase.storage.from(targetBucket).download(file.path);
    if (restored.error) throw restored.error;
    const restoredBytes = Buffer.from(await restored.data.arrayBuffer());
    const restoredHash = createHash("sha256").update(restoredBytes).digest("hex");
    if (restoredHash !== file.sha256 || restoredBytes.byteLength !== file.sizeBytes) {
      throw new Error(`Restored object failed integrity validation for ${file.bucket}/${file.path}.`);
    }
  }

  console.log(`Restored and verified ${(manifest.files ?? []).length} objects in an isolated Supabase project.`);
} finally {
  for (const targetBucket of restoreBuckets.values()) {
    await supabase.storage.emptyBucket(targetBucket).catch(() => undefined);
    await supabase.storage.deleteBucket(targetBucket).catch(() => undefined);
  }
}
