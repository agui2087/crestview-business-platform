import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { formatMoney, getMarketplaceListings } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "/listings", {
    title: "Small businesses for sale",
    description: "Browse small businesses for sale and use Crestview’s guided acquisition workspace to evaluate, request information, and move through due diligence.",
  });
}

export default async function PublicListingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const listings = await getMarketplaceListings();
  const city = typeof query.city === "string" ? query.city : "";
  const industry = typeof query.industry === "string" ? query.industry : "";
  const visible = listings.filter((item) => (!city || `${item.city}, ${item.state_code}` === city) && (!industry || item.industry === industry));
  const cities = [...new Set(listings.map((item) => `${item.city}, ${item.state_code}`))].sort();
  const industries = [...new Set(listings.map((item) => item.industry))].sort();
  return <><MarketingHeader locale={locale} /><main>
    <section className="listings-hero"><div className="shell"><p className="eyebrow">{es ? "Mercado Crestview" : "Crestview marketplace"}</p><h1>{es ? "Negocios para compradores serios." : "Businesses for serious buyers."}</h1><p>{es ? "Explora oportunidades públicas y crea una cuenta cuando estés listo para solicitar información confidencial." : "Explore public opportunities, then create an account when you are ready to request confidential information."}</p></div></section>
    <section className="section section--compact"><div className="shell public-listings">
      <form className="marketplace-filter" method="get"><label><span>{es ? "Ubicación" : "Location"}</span><select name="city" defaultValue={city}><option value="">{es ? "Todos los mercados" : "All markets"}</option>{cities.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label><span>{es ? "Industria" : "Industry"}</span><select name="industry" defaultValue={industry}><option value="">{es ? "Todas las industrias" : "All industries"}</option>{industries.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><button className="button button--primary" type="submit">{es ? "Mostrar resultados" : "Show results"}</button>{(city || industry) && <Link className="filter-reset" href={`/${locale}/listings`}>{es ? "Limpiar" : "Clear"}</Link>}</form>
      <div className="results-heading"><div><strong>{visible.length} {es ? "oportunidades" : visible.length === 1 ? "opportunity" : "opportunities"}</strong><span>{es ? "Información pública proporcionada por la fuente del anuncio" : "Public information provided by each listing source"}</span></div></div>
      <div className="marketplace-listings">{visible.map((listing) => <article className="marketplace-card" key={listing.id}><header><div><span className="source-label">{es ? "Oportunidad publicada" : "Published opportunity"}</span><h2>{listing.title}</h2><p>{listing.city}, {listing.state_code} · {listing.industry}</p></div><span className="stage">{es ? "Activo" : "Active"}</span></header><p className="marketplace-card__summary">{listing.summary}</p><div className="marketplace-card__metrics"><div><span>{es ? "Precio" : "Asking price"}</span><strong>{formatMoney(listing.asking_price)}</strong></div><div><span>{es ? "Ingresos" : "Revenue"}</span><strong>{formatMoney(listing.annual_revenue)}</strong></div><div><span>Cash flow</span><strong>{formatMoney(listing.cash_flow)}</strong></div></div><ul>{listing.public_highlights.slice(0, 3).map((item) => <li key={item}>✓ {item}</li>)}</ul><div className="public-listing-action"><Link className="button button--primary" href={`/${locale}/sign-in`}>{es ? "Iniciar sesión para solicitar información" : "Sign in to request information"}</Link></div></article>)}</div>
      {!visible.length && <div className="empty-state"><strong>{es ? "Aún no hay coincidencias exactas" : "No exact matches yet"}</strong><p>{es ? "Prueba otro filtro para ver más oportunidades." : "Try another filter to see more opportunities."}</p></div>}
    </div></section>
  </main><MarketingFooter locale={locale} /></>;
}
