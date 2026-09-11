"use client";
import { lenderPackageText } from "@/lib/lender-package";

type PackageProps = {
  locale: string;
  title: string;
  location: string;
  industry: string;
  askingPrice: string;
  revenue: string;
  cashFlow: string;
  missing: string[];
  buyerContribution?: number;
  sellerNote?: number;
  workingCapital?: number;
  hasPro: boolean;
  records?: string[];
};

export function LenderReadinessPackage(props: PackageProps) {
  const es = props.locale === "es";
  function download() {
    const blob = new Blob([lenderPackageText(props)], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${props.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-lender-package.txt`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return <section className={`lender-package ${props.hasPro ? "" : "is-locked"}`}>
    <div><span>{es ? "PAQUETE PARA PRESTAMISTA" : "LENDER PREPARATION PACKAGE"}</span><h2>{es ? "Llega preparado a la primera conversación" : "Bring one organized summary to the first lender conversation"}</h2><p>{es ? "Combina el resumen del trato, estructura de financiamiento, registros disponibles y documentos faltantes." : "Combines the deal summary, financing structure, available records, and missing documents in one shareable package."}</p></div>
    <div className="lender-package__contents"><strong>{props.title}</strong><span>{props.location} · {props.industry}</span><ul><li>{es?'Resumen del trato':'Deal summary'}</li><li>{es?'Aportación y financiamiento':'Contribution and financing'}</li><li>{es?'Inventario de documentos accesibles y pendientes':'Accessible document inventory and outstanding items'}</li></ul><small>{es?'Descarga de texto. No adjunta documentos ni concede acceso.':'Text download. Does not attach documents or grant access.'}</small></div>
    {props.hasPro ? <button className="button button--primary" type="button" onClick={download}>{es ? "Descargar paquete" : "Download lender package"}</button> : <a className="button button--primary" href={`/${props.locale}/pricing#buyer-pricing`}>{es ? "Desbloquear con Pro" : "Unlock package with Pro"}</a>}
    <small>{es ? "No es una solicitud ni aprobación de préstamo. Confirma todos los datos con el prestamista." : "Not a loan application or approval. Confirm every figure with the lender."}</small>
  </section>;
}
