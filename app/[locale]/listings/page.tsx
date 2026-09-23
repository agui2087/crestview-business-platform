import {MarketplaceFilters} from '@/components/marketplace-filters';
import {searchListings} from '@/lib/marketplace-search';
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { formatMoney, getMarketplaceListings } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";
import {ListingPromotionLabel} from '@/components/listing-promotion-label';
import {ListingFinancialContext} from '@/components/listing-financial-context';

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
  const {results: visible, errors} = searchListings(listings, query);
  const cities = [...new Set(listings.map((item) => `${item.city}, ${item.state_code}`))].sort();
  const industries = [...new Set(listings.map((item) => item.industry))].sort();
  return <><MarketingHeader locale={locale} /><main>
    <section className="listings-hero"><div className="shell listings-hero__grid">
      <div className="listings-hero__copy"><p className="eyebrow">{es ? "Mercado Crestview" : "Crestview marketplace"}</p><h1>{es ? "Explora tu próximo capítulo como propietario." : "Explore your next chapter in ownership."}</h1><p>{es ? "Desde tu primera exploración hasta una búsqueda activa: compara información pública, haz preguntas y avanza a tu ritmo." : "From your first look to an active search: compare public information, ask questions, and move forward at your own pace."}</p></div>
      <div className="listings-hero__art" aria-hidden="true">
        <article><span>{es ? "EXPLORA" : "EXPLORE"}</span><strong>{es ? "Compara la información" : "Compare the information"}</strong><small>{es ? "Datos del corredor o vendedor" : "Broker- or seller-provided facts"}</small></article>
        <article><span>{es ? "PREPÁRATE" : "PREPARE"}</span><strong>{es ? "Pregunta antes de decidir" : "Ask before deciding"}</strong><small>{es ? "Acceso privado por separado" : "Private access is a separate step"}</small></article>
        <i /><i />
      </div>
    </div></section>
    <section className="section section--compact"><div className="shell public-listings">
      <MarketplaceFilters query={query} cities={cities} industries={industries} locale={locale} path={`/${locale}/listings`} errors={errors}/>
      <div className="results-heading"><div><strong>{visible.length} {es ? "oportunidades" : visible.length === 1 ? "opportunity" : "opportunities"}</strong><span>{es ? "Información pública proporcionada por la fuente del anuncio" : "Public information provided by each listing source"}</span></div></div>
      <div className="marketplace-listings">{visible.map((listing) => <article className="marketplace-card" key={listing.id}><ListingPromotionLabel tier={listing.promotion?.tier} locale={locale}/><header><div><span className="source-label">{es ? "Oportunidad publicada" : "Published opportunity"}</span><h2>{listing.title}</h2><p>{listing.city}, {listing.state_code} · {listing.industry}</p></div><span className="stage">{es ? "Activo" : "Active"}</span></header><p className="marketplace-card__summary">{listing.summary}</p><div className="marketplace-card__metrics"><div><span>{es ? "Precio" : "Asking price"}</span><strong>{formatMoney(listing.asking_price)}</strong></div><div><span>{es ? "Ingresos" : "Revenue"}</span><strong>{formatMoney(listing.annual_revenue)}</strong></div><div><span>Cash flow</span><strong>{formatMoney(listing.cash_flow)}</strong></div></div><ListingFinancialContext listing={listing} locale={locale}/><ul>{listing.public_highlights.slice(0, 3).map((item) => <li key={item}>✓ {item}</li>)}</ul><div className="public-listing-action"><Link className="button button--primary" href={`/${locale}/sign-in`}>{es ? "Iniciar sesión para solicitar información" : "Sign in to request information"}</Link></div></article>)}</div>
      {!visible.length && <div className="empty-state"><strong>{es ? "Aún no hay coincidencias exactas" : "No exact matches yet"}</strong><p>{es ? "Prueba otro filtro para ver más oportunidades." : listings.length ? "Try another filter to see more opportunities." : "No published listings are currently available. Please check back later."}</p></div>}
    </div></section>
  </main><MarketingFooter locale={locale} /></>;
}
