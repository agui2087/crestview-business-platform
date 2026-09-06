const officeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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
