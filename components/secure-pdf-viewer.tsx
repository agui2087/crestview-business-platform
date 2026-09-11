"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "./secure-pdf-viewer.css";

export function SecurePdfViewer({ source, download, title, locale }: { source: string; download: string; title: string; locale: string }) {
  const es = locale === "es";
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    void (async () => {
      try {
        const pdf = await import("pdfjs-dist");
        if (cancelled) return;
        pdf.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        task = pdf.getDocument({ url: source, useSystemFonts: true, useWasm: false, maxImageSize: 16_000_000, disableAutoFetch: true, disableStream: true });
        task.onPassword = () => { if (!cancelled) { setFailed(true); setBusy(false); } void task?.destroy(); };
        const loaded = await task.promise;
        if (!cancelled) setDocument(loaded);
      } catch { if (!cancelled) { setFailed(true); setBusy(false); } }
    })();
    return () => { cancelled = true; void task?.destroy(); };
  }, [source]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    void (async () => {
      try {
        setBusy(true); setText(""); setFailed(false);
        const pdfPage = await document.getPage(page);
        if (cancelled || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(1.5 * zoom, Math.sqrt(8_000_000 / (base.width * base.height)));
        const viewport = pdfPage.getViewport({ scale });
        const target = canvas.current;
        target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
        render = pdfPage.render({ canvas: target, viewport });
        await render.promise;
        const contents = await pdfPage.getTextContent();
        if (!cancelled) { setText(contents.items.map(item => "str" in item ? item.str : "").join(" ")); setBusy(false); }
      } catch { if (!cancelled) { setFailed(true); setBusy(false); } }
    })();
    return () => { cancelled = true; render?.cancel(); };
  }, [document, page, zoom]);

  return <section className="secure-pdf" aria-label={es ? "Visor de PDF" : "PDF viewer"}>
    <div className="secure-pdf-toolbar">
      <a href={download} rel="noreferrer">{es ? "Descargar PDF" : "Download PDF"}</a>
      <a href={source} target="_blank" rel="noreferrer">{es ? "Abrir en el navegador" : "Open in browser"}</a>
      <button type="button" disabled={!document || page === 1 || busy} onClick={() => setPage(page - 1)}>{es ? "Anterior" : "Previous"}</button>
      <span>{es ? "Página" : "Page"} {page}{document ? ` / ${document.numPages}` : ""}</span>
      <button type="button" disabled={!document || page === document.numPages || busy} onClick={() => setPage(page + 1)}>{es ? "Siguiente" : "Next"}</button>
      <label>{es ? "Ampliación" : "Zoom"} <select value={zoom} disabled={busy || !document} onChange={e => setZoom(Number(e.target.value))}><option value={1}>100%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label>
    </div>
    <p>{es ? "El enlace es temporal. Si caduca, recarga esta página para comprobar de nuevo tus permisos." : "Access links are temporary. If a link expires, reload this page to check your permissions again."}</p>
    {busy && <p role="status">{es ? "Cargando página…" : "Loading page…"}</p>}
    {failed && <p role="alert">{es ? "No se pudo mostrar este PDF. Puede estar protegido, dañado o el enlace puede haber caducado. Recarga la página o descarga el archivo para abrirlo en tu lector de PDF." : "This PDF could not be displayed. It may be password-protected, damaged, or the link may have expired. Reload the page or download the file to open it in your PDF reader."}</p>}
    <div className="secure-pdf-sheet" hidden={failed} aria-busy={busy} tabIndex={0} role="region" aria-label={es ? "Página del documento, desplazable" : "Scrollable document page"}><canvas ref={canvas} role="img" aria-label={`${title} — ${es ? "página" : "page"} ${page}`} style={{ width: `${zoom * 100}%` }} /></div>
    {text && <details className="secure-pdf-text"><summary>{es ? "Texto de esta página" : "Text of this page"}</summary><p>{text}</p></details>}
    {!busy && !failed && !text && <p>{es ? "Esta página no contiene texto extraíble. Descarga el original si necesitas un lector con OCR." : "This page has no extractable text. Download the original if you need an OCR-capable reader."}</p>}
  </section>;
}
