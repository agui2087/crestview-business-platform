import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getCrestviewUser } from "@/lib/current-user";
import { formatMoney, getMyListings } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createListing, updateListingStatus } from "../marketplace/actions";

export const metadata: Metadata = { title: "Broker listings" };

export default async function ListingsPage({ params, searchParams }: PageProps<"/[locale]/dashboard/listings">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const user = await getCrestviewUser(locale);
  let userId: string | undefined;
  if (isSupabaseConfigured() && user.source === "supabase") {
    const supabase = await createSupabaseServerClient();
    userId = (await supabase.auth.getUser()).data.user?.id;
  }
  const listings = await getMyListings(userId);
  return (
    <PlatformShell locale={locale} active="listings">
      <div className="dashboard-content">
        <PageHeading eyebrow="Broker workspace" title="Your business listings" body="Publish opportunities, control confidential information, and manage every buyer inquiry from one place." />
        {query.created && <p className="notice">Your listing was saved successfully.</p>}
        {query.error && <p className="auth-error">We could not save that listing. Confirm that the marketplace migration is installed and try again.</p>}
        <div className="broker-summary">
          <article><span>Total listings</span><strong>{listings.length}</strong></article>
          <article><span>Published</span><strong>{listings.filter((item) => item.status === "published").length}</strong></article>
          <article><span>Buyer inquiries</span><strong>1</strong></article>
          <article><span>Awaiting signature</span><strong>1</strong></article>
        </div>
        <details className="listing-editor" open={!listings.length}>
          <summary>Create a new listing <span>Public and confidential fields stay separate</span></summary>
          <form action={createListing}>
            <input type="hidden" name="locale" value={locale} />
            <div className="listing-form-grid">
              <label className="span-two">Listing title<input name="title" placeholder="Established commercial services company" minLength={5} maxLength={140} required /></label>
              <label>Industry<input name="industry" placeholder="Commercial Services" required /></label>
              <label>City<input name="city" placeholder="Portland" required /></label>
              <label>State<input name="state_code" placeholder="OR" minLength={2} maxLength={2} required /></label>
              <label>Asking price<input name="asking_price" inputMode="decimal" placeholder="$1,250,000" /></label>
              <label>Annual revenue<input name="annual_revenue" inputMode="decimal" placeholder="$2,100,000" /></label>
              <label>Cash flow / SDE<input name="cash_flow" inputMode="decimal" placeholder="$425,000" /></label>
              <label className="span-two">Public summary<textarea name="summary" placeholder="Describe the business without exposing confidential details." minLength={20} required /></label>
              <label className="span-two">Public highlights<textarea name="public_highlights" placeholder={"Recurring customer contracts\nExperienced management team\nSeller transition available"} /></label>
              <label className="span-two confidential-field">Confidential notes<textarea name="confidential_notes" placeholder="Details only approved buyers should see after completing the NDA process." /></label>
            </div>
            <div className="listing-form-options">
              <label><input type="checkbox" name="financing_available" /> Seller financing may be available</label>
              <label><input type="checkbox" name="publish" /> Publish immediately</label>
            </div>
            <button className="button button--primary" type="submit">Save listing</button>
          </form>
        </details>
        <div className="listing-management">
          {listings.map((listing) => (
            <article key={listing.id}>
              <div><span>{listing.status.replaceAll("_", " ")}</span><h2>{listing.title}</h2><p>{listing.city}, {listing.state_code} · {formatMoney(listing.asking_price)}</p></div>
              {!listing.id.startsWith("demo-") && <form action={updateListingStatus}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="listing_id" value={listing.id} />
                <select name="status" defaultValue={listing.status}>
                  <option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option>
                  <option value="under_offer">Under offer</option><option value="sold">Sold</option><option value="withdrawn">Withdrawn</option>
                </select>
                <button type="submit">Update</button>
              </form>}
              {listing.id.startsWith("demo-") && <span className="stage">Example listing</span>}
            </article>
          ))}
        </div>
      </div>
    </PlatformShell>
  );
}
