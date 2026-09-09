const officeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const maxVaultDocumentBytes = 10 * 1024 * 1024;
export const maxDealRoomDocumentBytes = 20 * 1024 * 1024;

export type DocumentSafetyResult = { safe: true } | { safe: false; reason: string };
export type MalwareScanResult = {
  status: "clean" | "blocked" | "unavailable";
  provider: "cloudmersive" | "local";
  reason: string | null;
  sha256: string;
};

type ScanOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

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

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Runs Crestview's deterministic checks and, when configured, Cloudmersive's
 * advanced malware scan. The managed scanner is fail-closed: a timeout,
 * malformed response, or provider error leaves the file unavailable.
 */
export async function scanUploadedDocument(file: File, options: ScanOptions = {}): Promise<MalwareScanResult> {
  const fileSha256 = await sha256(file);
  const local = await inspectDocumentSafety(file);
  if (!local.safe) return { status: "blocked", provider: "local", reason: local.reason, sha256: fileSha256 };

  const apiKey = options.apiKey ?? process.env.CLOUDMERSIVE_VIRUS_API_KEY;
  if (!apiKey) return { status: "clean", provider: "local", reason: null, sha256: fileSha256 };

  const body = new FormData();
  body.append("inputFile", file, file.name);
  try {
    const response = await (options.fetchImpl ?? fetch)("https://api.cloudmersive.com/virus/scan/file/advanced", {
      method: "POST",
      headers: {
        Apikey: apiKey,
        fileName: file.name,
        allowExecutables: "false",
        allowInvalidFiles: "false",
        allowScripts: "false",
        allowPasswordProtectedFiles: "false",
        allowMacros: "false",
        allowXmlExternalEntities: "false",
        allowInsecureDeserialization: "false",
        allowHtml: "false",
        allowUnsafeArchives: "false",
        allowOleEmbeddedObject: "false",
        allowUnwantedAction: "false",
        restrictFileTypes: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { status: "unavailable", provider: "cloudmersive", reason: "Managed security scan could not be completed.", sha256: fileSha256 };
    const result = await response.json() as Record<string, unknown>;
    if (result.CleanResult === true) return { status: "clean", provider: "cloudmersive", reason: null, sha256: fileSha256 };
    if (result.CleanResult === false) return { status: "blocked", provider: "cloudmersive", reason: "The managed security scanner blocked this file.", sha256: fileSha256 };
    return { status: "unavailable", provider: "cloudmersive", reason: "Managed security scan returned an invalid result.", sha256: fileSha256 };
  } catch {
    return { status: "unavailable", provider: "cloudmersive", reason: "Managed security scan is temporarily unavailable.", sha256: fileSha256 };
  }
}

export function securityStatusForScan(result: MalwareScanResult) {
  if (result.status === "blocked") return "blocked" as const;
  if (result.status === "unavailable") return "quarantined" as const;
  return result.provider === "cloudmersive" ? "malware_scanned" as const : "basic_validated" as const;
}
