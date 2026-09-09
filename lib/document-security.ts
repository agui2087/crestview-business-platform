const officeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const maxVaultDocumentBytes = 10 * 1024 * 1024;
export const maxDealRoomDocumentBytes = 20 * 1024 * 1024;

export type DocumentSafetyResult = { safe: true } | { safe: false; reason: string };

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function hasValidDocumentSignature(contentType: string, bytes: Uint8Array) {
  if (bytes.length === 0) return false;
  if (contentType === "application/pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (contentType === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (officeTypes.has(contentType)) return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  if (contentType === "application/msword" || contentType === "application/vnd.ms-excel") {
    return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (contentType === "text/plain" || contentType === "text/csv") {
    return !bytes.slice(0, 4096).includes(0);
  }
  return false;
}

export async function validateUploadedDocument(file: File) {
  const sample = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  return hasValidDocumentSignature(file.type, sample);
}

/**
 * A fail-closed pre-storage safety screen. This does not pretend to replace a
 * commercial malware engine; it blocks the standard antivirus test payload,
 * executable headers, and active-content PDF markers before a file is stored.
 */
export async function inspectDocumentSafety(file: File): Promise<DocumentSafetyResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder("latin1").decode(bytes);
  if (text.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) {
    return { safe: false, reason: "The file was blocked by the security scanner." };
  }
  if (startsWith(bytes, [0x4d, 0x5a])) {
    return { safe: false, reason: "Executable files are not permitted." };
  }
  if (file.type === "application/pdf" && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/i.test(text)) {
    return { safe: false, reason: "Active-content PDF files are not permitted." };
  }
  return { safe: true };
}
