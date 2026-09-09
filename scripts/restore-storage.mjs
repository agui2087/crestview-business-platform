import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertIsolatedRestoreTarget, readVerifiedBackupFile, verifyStorageBackup } from "./storage-backup-safety.mjs";

const backupRoot = resolve(process.argv[2] ?? "work/storage-backup");
const supabaseUrl = process.env.RESTORE_SUPABASE_URL?.trim();
const serviceKey = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY?.trim();
const runLabel = (process.env.GITHUB_RUN_ID ?? Date.now().toString()).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32);

if (!supabaseUrl || !serviceKey) throw new Error("Isolated restore-target credentials are not configured.");
assertIsolatedRestoreTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseUrl);

// Verify every local object before creating buckets or sending private bytes.
const manifest = await verifyStorageBackup(backupRoot);

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
    const bytes = await readVerifiedBackupFile(backupRoot, file);
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

} finally {
  let cleanupFailed = false;
  for (const targetBucket of restoreBuckets.values()) {
    try {
      const emptied = await supabase.storage.emptyBucket(targetBucket);
      if (emptied.error) { cleanupFailed = true; continue; }
      const deleted = await supabase.storage.deleteBucket(targetBucket);
      if (deleted.error) cleanupFailed = true;
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) throw new Error("Restore cleanup failed. Private drill buckets may remain in the isolated target; operator review is required.");
}
console.log(`Restored and verified ${manifest.files.length} objects in an isolated Supabase project; drill buckets removed.`);
