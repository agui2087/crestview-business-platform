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

const categories = ["NDA", "Financials", "Tax returns", "Legal", "Employees", "Customers", "Assets", "Closing", "Operations", "Other"];

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentManager({ locale = "en" }: { locale?: string }) {
  const es = locale === "es";
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
    if (!file) return setMessage(es ? "Primero elige un archivo." : "Choose a file first.");
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    body.append("category", category);
    const response = await fetch("/api/documents", { method: "POST", body });
    const payload = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? (es ? "La carga falló." : "Upload failed."));
    setFile(null);
    setMessage(es ? "Carga completa." : "Upload complete.");
    await loadDocuments();
  }

  async function remove(id: string) {
    if (!window.confirm(es ? "¿Eliminar este documento? Esta acción no se puede deshacer." : "Delete this document? This cannot be undone.")) return;
    await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadDocuments();
  }

  return (
    <div className="documents-workspace">
      <section className="upload-card">
        <div><span>{es ? "Sala privada" : "Private deal room"}</span><h2>{es ? "Subir archivos de diligencia" : "Upload due-diligence files"}</h2><p>{es ? "PDF, Word, Excel, CSV, texto, PNG o JPEG. Máximo 10 MB por archivo." : "PDF, Word, Excel, CSV, text, PNG, or JPEG. Maximum 10 MB per file."}</p></div>
        <div className="upload-controls">
          <label>{es ? "Categoría" : "Document category"}<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="file-picker"><input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? file.name : (es ? "Elegir archivo" : "Choose a file")}</span></label>
          <button className="button button--primary" type="button" disabled={!file || busy} onClick={upload}>{busy ? (es ? "Subiendo…" : "Uploading…") : (es ? "Subir documento" : "Upload document")}</button>
        </div>
        {message && <p className="upload-message" role="status">{message}</p>}
      </section>
      <section className="document-list panel">
        <div className="panel__header"><h2>{es ? "Documentos subidos" : "Uploaded documents"}</h2><span>{documents.length} {es ? "archivos" : "files"}</span></div>
        {documents.length === 0 ? <div className="empty-state"><span>▣</span><h2>{es ? "Aún no hay documentos" : "No documents uploaded yet"}</h2><p>{es ? "Tus archivos aparecerán aquí y permanecerán privados." : "Your uploaded files will appear here and remain private to your account."}</p></div> : documents.map((document) => (
          <article className="document-row" key={document.id}>
            <div><span>{document.category} · <b>{es ? "Recibido" : "Received"}</b></span><strong>{document.originalName}</strong><small>{fileSize(document.sizeBytes)} · {new Date(document.createdAt).toLocaleDateString()} · {es ? "Revisión pendiente" : "Review pending"}</small></div>
            <div><a href={`/api/documents/${document.id}`}>{es ? "Descargar" : "Download"}</a><button type="button" onClick={() => remove(document.id)}>{es ? "Eliminar" : "Delete"}</button></div>
          </article>
        ))}
      </section>
    </div>
  );
}
