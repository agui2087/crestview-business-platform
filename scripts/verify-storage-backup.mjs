import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const backupRoot = resolve(process.argv[2] ?? "work/storage-backup");
const manifest = JSON.parse(await readFile(join(backupRoot, "manifest.json"), "utf8"));
for (const file of manifest.files ?? []) {
  const bytes = await readFile(join(backupRoot, file.bucket, ...String(file.path).split("/")));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== file.sha256 || bytes.byteLength !== file.sizeBytes) {
    throw new Error(`Backup integrity check failed for ${file.bucket}/${file.path}.`);
  }
}
console.log(`Verified ${(manifest.files ?? []).length} restored storage objects by size and SHA-256.`);
