import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getMarketplaceListings, formatMoney } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { createInquiry } from "./actions";

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
        <PageHeading
          eyebrow="Crestview marketplace"
          title="Businesses ready for serious buyers"
          body="Explore broker-posted opportunities, request confidential information, and move each conversation into one secure workspace."
        />
        <div className="marketplace-trust">
          <div><strong>{listings.length}</strong><span>Active opportunities</span></div>
          <div><strong>Secure</strong><span>NDA-gated deal rooms</span></div>
          <div><strong>Connected</strong><span>Buyer and broker messaging</span></div>
        </div>
        <div className="marketplace-flow" aria-label="How Crestview marketplace works">
          <span><strong>1</strong> Find a business</span>
          <span><strong>2</strong> Open and sign the NDA</span>
          <span><strong>3</strong> Request financial access</span>
          <span><strong>4</strong> Broker reviews your request</span>
        </div>
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
        <div className="marketplace-listings">
          {visibleListings.map((listing) => (
            <article className="marketplace-card" key={listing.id}>
              <header>
                <div>
                  <span className="source-label">Broker-posted opportunity</span>
                  <h2>{listing.title}</h2>
                  <p>{listing.city}, {listing.state_code} · {listing.industry}</p>
                </div>
                <span className="stage">Active</span>
              </header>
              <p className="marketplace-card__summary">{listing.summary}</p>
              <div className="marketplace-card__metrics">
                <div><span>Asking price</span><strong>{formatMoney(listing.asking_price)}</strong></div>
                <div><span>Revenue</span><strong>{formatMoney(listing.annual_revenue)}</strong></div>
                <div><span>Cash flow</span><strong>{formatMoney(listing.cash_flow)}</strong></div>
              </div>
              <ul>{listing.public_highlights.map((item) => <li key={item}>✓ {item}</li>)}</ul>
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
        </div>
        {!visibleListings.length && <div className="empty-state"><strong>No exact matches yet</strong><p>Clear a filter or set a listing alert and Crestview will keep watch for you.</p><Link className="button button--primary" href={`/${locale}/dashboard/settings#listing-alerts`}>Set listing alert</Link></div>}
      </div>
    </PlatformShell>
  );
}
