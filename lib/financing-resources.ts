export type FinancingResource = {
  name: string;
  kind: "lenders" | "office" | "advisor" | "match";
  description: string;
  descriptionEs: string;
  href: string;
  phone?: string;
  area: string;
  checked: string;
};

const national: FinancingResource[] = [
  { name: "SBA Lender Match", kind: "match", description: "Share the proposed loan and hear from participating SBA lenders interested in the request.", descriptionEs: "Comparte el préstamo propuesto y recibe interés de prestamistas participantes de SBA.", href: "https://www.sba.gov/funding-programs/loans/lender-match-connects-you-lenders", area: "Nationwide", checked: "August 2026" },
  { name: "SBA local assistance", kind: "advisor", description: "Find free or low-cost SBDC, SCORE, and other business counseling near the listing.", descriptionEs: "Encuentra asesoría de SBDC, SCORE y otros recursos cerca del anuncio.", href: "https://www.sba.gov/local-assistance", area: "Nationwide", checked: "August 2026" },
];

const regional: Record<string, FinancingResource[]> = {
  OR: [
    { name: "Oregon & SW Washington participating lenders", kind: "lenders", description: "Official SBA list of participating lenders serving Oregon and southwest Washington.", descriptionEs: "Lista oficial de prestamistas SBA que sirven a Oregon y el suroeste de Washington.", href: "https://www.sba.gov/document/support-portland-lender-list", area: "Oregon and SW Washington", checked: "August 2026" },
    { name: "SBA Portland District Office", kind: "office", description: "Ask for funding-program guidance and connections to lenders or local resource partners.", descriptionEs: "Solicita orientación sobre financiamiento y conexiones con prestamistas o recursos locales.", href: "https://www.sba.gov/district/portland", phone: "503-326-2682", area: "Most of Oregon and SW Washington", checked: "August 2026" },
  ],
  WA: [
    { name: "Washington participating SBA lenders", kind: "lenders", description: "Official SBA list of participating lenders for the Seattle District.", descriptionEs: "Lista oficial de prestamistas participantes de SBA para el distrito de Seattle.", href: "https://www.sba.gov/document/support-seattle-lender-list", area: "Washington and northern Idaho", checked: "August 2026" },
    { name: "SBA Seattle District Office", kind: "office", description: "Contact the district office for local funding help and lender connections.", descriptionEs: "Contacta la oficina del distrito para ayuda financiera y conexiones con prestamistas.", href: "https://www.sba.gov/district/seattle", phone: "206-553-7310", area: "Washington and northern Idaho", checked: "August 2026" },
  ],
  CA_NORTH: [
    { name: "Northern California SBA lender list", kind: "lenders", description: "Official SBA list of lenders that have made 7(a) loans in the San Francisco District.", descriptionEs: "Lista oficial de prestamistas que han realizado préstamos 7(a) en el distrito de San Francisco.", href: "https://www.sba.gov/document/support-san-francisco-lender-list", area: "San Francisco and Northern California", checked: "August 2026" },
    { name: "SBA San Francisco District Office", kind: "office", description: "Ask about funding programs, local participating lenders, and counseling partners.", descriptionEs: "Pregunta sobre financiamiento, prestamistas participantes y organizaciones de asesoría.", href: "https://www.sba.gov/district/san-francisco", phone: "415-744-6820", area: "San Francisco and Northern California", checked: "August 2026" },
  ],
  CA: [
    { name: "California SBA district offices", kind: "office", description: "Choose the district that serves the listing to reach local lender-relations and funding staff.", descriptionEs: "Elige el distrito del anuncio para contactar al personal local de financiamiento.", href: "https://www.sba.gov/about-sba/sba-locations/sba-district-offices", area: "California", checked: "August 2026" },
    { name: "California SBDC network", kind: "advisor", description: "Find a nearby advisor who can help prepare projections, a business plan, and a lender package.", descriptionEs: "Encuentra un asesor cercano que ayude con proyecciones, plan de negocio y solicitud financiera.", href: "https://americassbdc.org/find-your-sbdc/", area: "California", checked: "August 2026" },
  ],
};

function regionFor(location: string) {
  const value = location.toLowerCase();
  if (/\b(or|oregon)\b/.test(value)) return "OR";
  if (/\b(wa|washington)\b/.test(value)) return "WA";
  if (/san francisco|alameda|northern california|bay area|marin|san mateo|santa clara/.test(value)) return "CA_NORTH";
  if (/\b(ca|california)\b/.test(value)) return "CA";
  return "";
}

export function financingResourcesFor(location: string) {
  return [...(regional[regionFor(location)] ?? []), ...national];
}
