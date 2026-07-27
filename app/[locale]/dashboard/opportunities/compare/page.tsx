import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

export default async function ComparePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { ids = "" } = await searchParams;
  const items = ids.split(",").slice(0, 4).map(getOpportunity).filter(Boolean);
  const es = locale === "es";
  const rows = [
    [es ? "Precio solicitado" : "Asking price", "price"],
    [es ? "Ingresos" : "Revenue", "revenue"],
    [es ? "Flujo de caja / SDE" : "Cash flow / SDE", "cashFlow"],
    ["EBITDA", "ebitda"],
    [es ? "Industria" : "Industry", "industry"],
    [es ? "Ubicación" : "Location", "location"],
    [es ? "Fuente" : "Source", "source"],
  ] as const;
  return <PlatformShell locale={locale} active="opportunities"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Comparación" : "Side by side"} title={es ? "Comparar oportunidades" : "Compare opportunities"} body={es ? "Compara datos públicos sin convertir información faltante en cero." : "Compare public facts without treating missing information as zero."} />
    {!items.length ? <div className="empty-state"><h2>{es ? "Selecciona negocios para comparar" : "Select businesses to compare"}</h2><Link className="button button--primary" href={`/${locale}/dashboard/opportunities`}>{es ? "Explorar oportunidades" : "Browse opportunities"}</Link></div> :
    <div className="comparison-wrap"><table className="comparison-table"><thead><tr><th>{es ? "Dato" : "Metric"}</th>{items.map((item) => <th key={item!.id}><Link href={`/${locale}/dashboard/opportunities/${item!.id}`}>{item!.title}</Link></th>)}</tr></thead><tbody>
      {rows.map(([label, key]) => <tr key={key}><th>{label}</th>{items.map((item) => <td key={item!.id}>{item![key]}</td>)}</tr>)}
      <tr><th>{es ? "Información faltante" : "Missing information"}</th>{items.map((item) => <td key={item!.id}>{item!.missing.length ? item!.missing.join(", ") : (es ? "Ninguna indicada" : "None identified")}</td>)}</tr>
    </tbody></table></div>}
  </div></PlatformShell>;
}
