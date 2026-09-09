import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";

export function assertIsolatedRestoreTarget(source, target) {
  const project = (value) => {
    if (typeof value !== "string" || !value.trim()) throw new Error("Source and restore project URLs are required.");
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ||
      !["", "/"].includes(url.pathname) || url.search || url.hash) {
      throw new Error("Use canonical HTTPS Supabase project URLs for the restore safety check.");
    }
    return url.hostname;
  };
  if (project(source) === project(target)) throw new Error("Storage restore target must not be the source project.");
}

export function validateStorageManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.buckets) || !manifest.buckets.length || !Array.isArray(manifest.files)) {
    throw new Error("Backup manifest must declare buckets and files.");
  }
  const counts = new Map();
  for (const bucket of manifest.buckets) {
    if (!bucket || typeof bucket.name !== "string" || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket.name) ||
      counts.has(bucket.name) || !Number.isSafeInteger(bucket.objectCount) || bucket.objectCount < 0) {
      throw new Error("Invalid or duplicate backup bucket.");
    }
    counts.set(bucket.name, 0);
  }
  const paths = new Set();
  for (const file of manifest.files) {
    if (!file || !counts.has(file.bucket) || typeof file.path !== "string" ||
      /[\\\x00-\x1f\x7f]/.test(file.path) || file.path.split("/").some((p) => !p || p === "." || p === "..") ||
      !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0 ||
      typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error("Invalid backup file entry.");
    }
    const key = `${file.bucket}/${file.path}`;
    if (paths.has(key)) throw new Error("Duplicate backup object.");
    paths.add(key);
    counts.set(file.bucket, counts.get(file.bucket) + 1);
  }
  for (const bucket of manifest.buckets) {
    if (counts.get(bucket.name) !== bucket.objectCount) throw new Error("Backup object count does not match manifest.");
  }
  return manifest;
}

export async function readVerifiedBackupFile(root, file) {
  const canonicalRoot = await realpath(root);
  const path = join(canonicalRoot, file.bucket, ...file.path.split("/"));
  const actual = await realpath(path);
  const offset = relative(canonicalRoot, actual);
  if (offset === ".." || offset.startsWith("../") || isAbsolute(offset) || !(await lstat(path)).isFile()) {
    throw new Error("Backup object must be a regular file within the backup directory.");
  }
  const bytes = await readFile(actual);
  if (bytes.length !== file.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
    throw new Error("Backup object failed size or SHA-256 verification.");
  }
  return bytes;
}

export async function verifyStorageBackup(root) {
  const manifest = validateStorageManifest(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")));
  for (const file of manifest.files) await readVerifiedBackupFile(root, file);
  return manifest;
}
