import { notFound } from "next/navigation";
import { SecurePdfViewer } from "@/components/secure-pdf-viewer";

// Synthetic renderer harness only. It cannot be enabled on a production build.
export default async function PdfViewerTest({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  if (process.env.NODE_ENV !== "development" || process.env.CRESTVIEW_E2E !== "true") notFound();
  const { locale } = await searchParams;
  return <main><h1>Synthetic PDF test</h1><SecurePdfViewer source="/__pdf-fixture.pdf" download="/__pdf-fixture.pdf?download=1" title="Synthetic PDF test" locale={locale === "es" ? "es" : "en"}/></main>;
}
