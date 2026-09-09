import { resolve } from "node:path";
import { verifyStorageBackup } from "./storage-backup-safety.mjs";

const backupRoot = resolve(process.argv[2] ?? "work/storage-backup");
const manifest = await verifyStorageBackup(backupRoot);
console.log(`Verified ${manifest.files.length} local backup objects by size and SHA-256; this is not a hosted restore test.`);
