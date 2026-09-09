import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertIsolatedRestoreTarget, validateStorageManifest, verifyStorageBackup } from "../scripts/storage-backup-safety.mjs";

const bytes = Buffer.from("Synthetic restore test; no customer data.");
const file = { bucket: "vault-files", path: "folder/test.txt", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
const manifest = () => ({ buckets: [{ name: "vault-files", objectCount: 1 }], files: [{ ...file }] });

test("restore target check normalizes equivalent project URLs and fails closed", () => {
  assert.throws(() => assertIsolatedRestoreTarget("https://source.supabase.co", " https://SOURCE.supabase.co/ "));
  for (const source of [undefined, "", "http://source.supabase.co", "https://alias.example.com", "https://source.supabase.co/path"]) {
    assert.throws(() => assertIsolatedRestoreTarget(source, "https://restore.supabase.co"));
  }
  for (const target of ["https://u:p@restore.supabase.co", "https://restore.supabase.co?x=1", "https://restore.supabase.co:444", "https://restore.supabase.co/#x"]) {
    assert.throws(() => assertIsolatedRestoreTarget("https://source.supabase.co", target));
  }
  assert.doesNotThrow(() => assertIsolatedRestoreTarget("https://source.supabase.co/", "https://restore.supabase.co"));
});

test("manifest rejects unsafe paths, duplicates, unknown buckets and incorrect counts", () => {
  assert.doesNotThrow(() => validateStorageManifest(manifest()));
  for (const path of ["../outside", "/absolute", "a/../../outside", "a\\outside", "a//b", "a/./b", "", "a\u0000b"]) {
    const value = manifest(); value.files[0].path = path;
    assert.throws(() => validateStorageManifest(value));
  }
  for (const value of [{}, { buckets: [], files: [] }, { ...manifest(), files: [] },
    { ...manifest(), files: [file, file] },
    { ...manifest(), files: [{ ...file, bucket: "unknown" }] },
    { ...manifest(), files: [{ ...file, sha256: "invalid" }] },
    { ...manifest(), files: [{ ...file, sizeBytes: -1 }] },
    { ...manifest(), buckets: [{ name: "../outside", objectCount: 1 }] }]) {
    assert.throws(() => validateStorageManifest(value));
  }
  assert.doesNotThrow(() => validateStorageManifest({ buckets: [{ name: "vault-files", objectCount: 0 }], files: [] }));
});

test("backup byte verification rejects corruption, missing files and symlink escapes", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "crestview-backup-test-"));
  const root = join(fixture, "backup");
  const object = join(root, "vault-files", "folder", "test.txt");
  try {
    await mkdir(join(root, "vault-files", "folder"), { recursive: true });
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest()));
    await writeFile(object, bytes);
    assert.equal((await verifyStorageBackup(root)).files.length, 1);
    await writeFile(object, Buffer.alloc(bytes.length, 0));
    await assert.rejects(verifyStorageBackup(root));
    await rm(object);
    await assert.rejects(verifyStorageBackup(root));
    const outside = join(fixture, "outside.txt");
    await writeFile(outside, bytes);
    await symlink(outside, object);
    await assert.rejects(verifyStorageBackup(root));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
