import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getMarketplaceListings, formatMoney } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { askListingQuestion, createInquiry } from "./actions";
import {ListingPromotionLabel} from '@/components/listing-promotion-label';
import {PromotionAnalytics,PromotionEngagement} from '@/components/promotion-engagement';
import {ListingFinancialContext} from '@/components/listing-financial-context';

export const metadata: Metadata = { title: "Marketplace" };

export default async function MarketplacePage({ params, searchParams }: PageProps<"/[locale]/dashboard/marketplace">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const listings = await getMarketplaceListings();
  const city = typeof query.city === "string" ? query.city : "";
  const industry = typeof query.industry === "string" ? query.industry : "";
  const visibleListings = listings.filter((listing) => {
    const matchesCity = !city || `${listing.city}, ${listing.state_code}` === city;
    const matchesIndustry = !industry || listing.industry === industry;
    return matchesCity && matchesIndustry;
  });
  const cities = [...new Set(listings.map((listing) => `${listing.city}, ${listing.state_code}`))];
  const industries = [...new Set(listings.map((listing) => listing.industry))];
  return (
    <PlatformShell locale={locale} active="marketplace">
      <div className="dashboard-content marketplace-page">
        {query.error === "question" && <p className="notice" role="alert">{locale === "es" ? "No se envió la pregunta. Revisa que tenga entre 10 y 5000 caracteres y que la conversación siga abierta. Si enviaste muchos mensajes, espera antes de reintentar." : "Your question was not sent. Check that it contains 10–5,000 characters and the conversation is still open. If you sent many messages, wait before retrying."}</p>}
        <PageHeading
          eyebrow="Crestview marketplace"
          title="Explore businesses at your own pace"
          body="Explore broker-posted opportunities, request confidential information, and move each conversation into one secure workspace."
        />
        <p className="notice">{locale==='es'?'¿Todavía estás aprendiendo o ahorrando? Eres bienvenido. Explora información pública y prepara tus próximos pasos sin prometer fondos que aún no tienes.':'Still learning or building savings? You are welcome. Explore public information and prepare your next steps without claiming funds you do not yet have.'} <Link href={`/${locale}/dashboard/preparation`}>{locale==='es'?'Mi plan de preparación':'My preparation plan'}</Link></p>
        <div className="marketplace-trust">
          <div><strong>{listings.length}</strong><span>Active opportunities</span></div>
          <div><strong>Secure</strong><span>NDA-gated deal rooms</span></div>
          <div><strong>Connected</strong><span>Buyer and broker messaging</span></div>
        </div>
        <div className="marketplace-flow" aria-label="How Crestview marketplace works" tabIndex={0}>
          <span><strong>1</strong> Find a business</span>
          <span><strong>2</strong> Open and sign the NDA</span>
          <span><strong>3</strong> Request financial access</span>
          <span><strong>4</strong> Broker reviews your request</span>
        </div>
        <p className="marketplace-disclosure"><strong>Know the source:</strong> Listing facts and documents are provided by the broker or seller. Crestview records access and workflow history but does not independently verify every claim. Confirm material information with qualified legal, accounting, and lending professionals before relying on it.</p>
        <form className="marketplace-filter" method="get">
          <label>
            <span>Location</span>
            <select name="city" defaultValue={city}>
              <option value="">All major markets</option>
              {cities.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Industry</span>
            <select name="industry" defaultValue={industry}>
              <option value="">All industries</option>
              {industries.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <button className="button button--primary" type="submit">Show matches</button>
          {(city || industry) && <Link className="filter-reset" href={`/${locale}/dashboard/marketplace`}>Clear filters</Link>}
        </form>
        <div className="results-heading">
          <div><strong>{visibleListings.length} {visibleListings.length === 1 ? "opportunity" : "opportunities"}</strong><span>Broker-posted and ready for review</span></div>
          <Link href={`/${locale}/dashboard/settings#listing-alerts`}>Set listing alerts →</Link>
        </div>
        <PromotionAnalytics locale={locale}><div className="marketplace-listings">
          {visibleListings.map((listing) => (
            <article className="marketplace-card" key={listing.id} id={`listing-${listing.id}`}>
              <ListingPromotionLabel tier={listing.promotion?.tier} locale={locale}/>
              {listing.promotion && <PromotionEngagement listingId={listing.id}/>}
              <header>
                <div>
                  <span className="source-label">Broker-posted opportunity</span>
                  <h2>{listing.title}</h2>
                  <p>{listing.city}, {listing.state_code} · {listing.industry}</p>
                </div>
                <span className="stage">Active</span>
              </header>
              <div className="listing-confidence"><span>Listing completeness</span><i><b style={{ width: `${listing.quality_score ?? 70}%` }} /></i><strong>{listing.quality_score ?? 70}%</strong></div>
              <p className="marketplace-card__summary">{listing.summary}</p>
              <div className="marketplace-card__metrics">
                <div><span>Asking price</span><strong>{formatMoney(listing.asking_price)}</strong></div>
                <div><span>Revenue</span><strong>{formatMoney(listing.annual_revenue)}</strong></div>
                <div><span>Cash flow</span><strong>{formatMoney(listing.cash_flow)}</strong></div>
              </div>
              <ul>{listing.public_highlights.map((item) => <li key={item}>✓ {item}</li>)}</ul>
              <ListingFinancialContext listing={listing} locale={locale}/>
              <details className="request-panel">
                <summary>{locale === "es" ? "Hacer una pregunta antes de continuar" : "Ask a question before moving forward"}</summary>
                <form action={askListingQuestion}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="listing_id" value={listing.id} />
                  <p>{locale === "es" ? "Puedes estar empezando o explorando financiación. Pregunta sobre la información pública; no necesitas declarar fondos disponibles." : "First-time buyers and people exploring financing are welcome. Ask about public listing information without declaring funds available."}</p>
                  <label className="request-message">{locale === "es" ? "Tu pregunta" : "Your question"}
                    <textarea name="question" required minLength={10} maxLength={5000} placeholder={locale === "es" ? "¿Qué experiencia necesita el nuevo propietario?" : "What operating experience would help a new owner succeed?"} />
                  </label>
                  <p className="advisor-note">{locale === "es" ? "Esto no solicita un NDA ni acceso a documentos privados. Se aplican tus preferencias actuales de compartir el perfil." : "This does not request an NDA or access to private documents. Your existing profile-sharing preferences apply."}</p>
                  <button className="button button--primary" type="submit">{locale === "es" ? "Enviar pregunta" : "Send question"}</button>
                </form>
              </details>
              <details className="request-panel">
                <summary>{listing.nda_automatic ? "Review the NDA instantly" : "Request the listing NDA"} <span>→</span></summary>
                <form action={createInquiry}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="listing_id" value={listing.id} />
                  <div className="request-form-grid">
                    <label>Acquisition experience
                      <select name="acquisition_experience" defaultValue="first-time">
                        <option value="first-time">First-time buyer</option>
                        <option value="operator">Experienced operator</option>
                        <option value="investor">Investor / sponsor</option>
                        <option value="strategic">Strategic acquirer</option>
                      </select>
                    </label>
                    <label>Funding readiness
                      <select name="funding_readiness" defaultValue="exploring">
                        <option value="exploring">Exploring financing</option>
                        <option value="prequalified">Financing prequalified</option>
                        <option value="proof-ready">Proof of funds available</option>
                      </select>
                    </label>
                  </div>
                  <label className="request-message">Message to broker
                    <textarea name="message" defaultValue={`Hello,\n\nI am interested in ${listing.title} and would like to review the listing NDA. I understand that financial information requires a separate request and broker approval after the NDA is signed.\n\nThank you.`} required />
                  </label>
                  <p className="nda-delivery-note"><strong>{listing.nda_automatic ? "Instant NDA delivery" : "Broker-provided NDA"}</strong><span>{listing.nda_automatic ? "The agreement will open immediately. The broker is notified only after you sign it or request financial access." : "The broker will receive a single request to provide the agreement."}</span></p>
                  <p className="advisor-note">Requesting or signing an NDA does not create an offer, financing commitment, or approval to receive financial records.</p>
                  <button className="button button--primary" type="submit">{listing.nda_automatic ? "Open NDA" : "Request NDA"}</button>
                </form>
              </details>
            </article>
          ))}
        </div></PromotionAnalytics>
        {!visibleListings.length && <div className="empty-state"><strong>No exact matches yet</strong><p>Clear a filter or set a listing alert and Crestview will keep watch for you.</p><Link className="button button--primary" href={`/${locale}/dashboard/settings#listing-alerts`}>Set listing alert</Link></div>}
      </div>
    </PlatformShell>
  );
}
