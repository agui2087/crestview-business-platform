"use client";

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
};

export function LenderReadinessPackage(props: PackageProps) {
  const es = props.locale === "es";
  const money = new Intl.NumberFormat(props.locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const packageText = [
    "CRESTVIEW LENDER PREPARATION PACKAGE",
    `Opportunity: ${props.title}`,
    `Location: ${props.location}`,
    `Industry: ${props.industry}`,
    `Asking price: ${props.askingPrice}`,
    `Reported revenue: ${props.revenue}`,
    `Reported cash flow: ${props.cashFlow}`,
    `Buyer contribution: ${money.format(props.buyerContribution ?? 0)}`,
    `Seller financing: ${money.format(props.sellerNote ?? 0)}`,
    `Working capital request: ${money.format(props.workingCapital ?? 0)}`,
    "",
    "AVAILABLE RECORDS",
    "Confirm inside the Crestview document room before sharing.",
    "",
    "MISSING OR UNVERIFIED ITEMS",
    ...(props.missing.length ? props.missing.map((item) => `- ${item}`) : ["- None identified from the public listing"]),
    "",
    "Important: This package organizes buyer-entered and listing-reported information. It is not a loan application, approval, valuation, or verification by Crestview.",
  ].join("\n");

  function download() {
    const blob = new Blob([packageText], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${props.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-lender-package.txt`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return <section className={`lender-package ${props.hasPro ? "" : "is-locked"}`}>
    <div><span>{es ? "PAQUETE PARA PRESTAMISTA" : "LENDER PREPARATION PACKAGE"}</span><h2>{es ? "Llega preparado a la primera conversación" : "Bring one organized summary to the first lender conversation"}</h2><p>{es ? "Combina el resumen del trato, estructura de financiamiento, registros disponibles y documentos faltantes." : "Combines the deal summary, financing structure, available records, and missing documents in one shareable package."}</p></div>
    <div className="lender-package__contents"><strong>{props.title}</strong><span>{props.location} · {props.industry}</span><ul><li>Deal summary and purchase request</li><li>Buyer contribution and seller financing</li><li>Cash-flow and working-capital inputs</li><li>Available records and missing-document list</li></ul></div>
    {props.hasPro ? <button className="button button--primary" type="button" onClick={download}>{es ? "Descargar paquete" : "Download lender package"}</button> : <a className="button button--primary" href={`/${props.locale}/pricing#buyer-pricing`}>{es ? "Desbloquear con Pro" : "Unlock package with Pro"}</a>}
    <small>{es ? "No es una solicitud ni aprobación de préstamo. Confirma todos los datos con el prestamista." : "Not a loan application or approval. Confirm every figure with the lender."}</small>
  </section>;
}
