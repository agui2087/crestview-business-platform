"use client";

import { useCallback, useEffect, useState } from "react";

type DocumentRecord = {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  category: string;
  opportunityId: string | null;
  createdAt: string;
};

const categories = ["Financials", "Tax returns", "Legal", "Operations", "Employees", "Customer data", "Other"];

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentManager() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/documents", { cache: "no-store" });
    const payload = await response.json() as { documents?: DocumentRecord[] };
    setDocuments(payload.documents ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDocuments(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDocuments]);

  async function upload() {
    if (!file) return setMessage("Choose a file first.");
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    body.append("category", category);
    const response = await fetch("/api/documents", { method: "POST", body });
    const payload = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? "Upload failed.");
    setFile(null);
    setMessage("Upload complete.");
    await loadDocuments();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadDocuments();
  }

  return (
    <div className="documents-workspace">
      <section className="upload-card">
        <div><span>Private deal room</span><h2>Upload due-diligence files</h2><p>PDF, Word, Excel, CSV, text, PNG, or JPEG. Maximum 10 MB per file.</p></div>
        <div className="upload-controls">
          <label>Document category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="file-picker"><input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? file.name : "Choose a file"}</span></label>
          <button className="button button--primary" type="button" disabled={!file || busy} onClick={upload}>{busy ? "Uploading…" : "Upload document"}</button>
        </div>
        {message && <p className="upload-message" role="status">{message}</p>}
      </section>
      <section className="document-list panel">
        <div className="panel__header"><h2>Uploaded documents</h2><span>{documents.length} files</span></div>
        {documents.length === 0 ? <div className="empty-state"><span>▣</span><h2>No documents uploaded yet</h2><p>Your uploaded files will appear here and remain private to this site while account access is being built.</p></div> : documents.map((document) => (
          <article className="document-row" key={document.id}>
            <div><span>{document.category}</span><strong>{document.originalName}</strong><small>{fileSize(document.sizeBytes)} · {new Date(document.createdAt).toLocaleDateString()}</small></div>
            <div><a href={`/api/documents/${document.id}`}>Download</a><button type="button" onClick={() => remove(document.id)}>Delete</button></div>
          </article>
        ))}
      </section>
    </div>
  );
}
