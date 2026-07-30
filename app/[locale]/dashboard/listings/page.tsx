import type { Metadata } from "next";
import Link from "next/link";
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
        <PageHeading
          eyebrow="Broker workspace"
          title="Your business listings"
          body="Publish opportunities, automate your standard NDA, and personally approve access to sensitive financial information."
          action={<Link className="button button--primary" href={`/${locale}/dashboard/listings?new=1#new-listing`}>+ Add a listing</Link>}
        />
        {query.created && <p className="notice">Your listing was saved successfully.</p>}
        {query.error && <p className="auth-error">We could not save that listing. Confirm that the marketplace migration is installed and try again.</p>}
        <div className="broker-summary">
          <article><span>Total listings</span><strong>{listings.length}</strong></article>
          <article><span>Published</span><strong>{listings.filter((item) => item.status === "published").length}</strong></article>
          <article><span>Buyer inquiries</span><strong>1</strong></article>
          <article><span>Awaiting signature</span><strong>1</strong></article>
        </div>
        <div className="broker-flow">
          <span><strong>1</strong> Create the listing</span>
          <span><strong>2</strong> Add your standard NDA</span>
          <span><strong>3</strong> Review serious buyers</span>
        </div>
        <details className="listing-editor" id="new-listing" open={!listings.length || query.new === "1"}>
          <summary><span><strong>Create a new listing</strong><small>Only the listing details are required. Everything else is optional.</small></span><b>+</b></summary>
          <form action={createListing}>
            <input type="hidden" name="locale" value={locale} />
            <div className="form-section-heading"><span>01</span><div><strong>Public listing details</strong><small>Buyers can see these fields before requesting access.</small></div></div>
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
            </div>
            <div className="form-section-heading nda-automation"><span>02</span><div><strong>Add your NDA</strong><small>Upload it once. Buyers can review and sign it without waiting for you.</small></div></div>
            <div className="nda-template-editor">
              <label className="span-three nda-upload-primary">Upload your approved NDA
                <input name="nda_file" type="file" accept="application/pdf,.pdf" />
                <small>PDF only, up to 10 MB. Crestview records exactly which version each buyer signs.</small>
              </label>
              <label className="nda-confirmation span-three"><input type="checkbox" name="nda_attested" /> I am authorized to use this NDA and have had it reviewed for this listing.</label>
              <input type="hidden" name="auto_send_nda" value="on" />
              <details className="nda-advanced span-three">
                <summary>Optional NDA details</summary>
                <div>
                  <label>Agreement name<input name="nda_document_name" defaultValue="Confidentiality agreement" /></label>
                  <label>Plain-language summary<textarea name="nda_template_body" placeholder="Briefly explain what the NDA protects. The PDF remains the controlling document." /></label>
                </div>
              </details>
            </div>
            <details className="listing-optional-section">
              <summary>Add private notes and selling options</summary>
              <div className="listing-form-grid">
                <label className="span-two confidential-field">Private broker notes<textarea name="confidential_notes" placeholder="Notes for the protected deal workspace. These never appear on the public listing." /></label>
              </div>
              <div className="listing-form-options">
                <label><input type="checkbox" name="financing_available" /> Seller financing may be available</label>
              </div>
            </details>
            <p className="advisor-note">Crestview stores the NDA and records electronic acceptance; it does not draft or approve legal terms. Use an attorney-reviewed agreement.</p>
            <div className="listing-submit-row">
              <label><input type="checkbox" name="publish" /> Publish as soon as I save</label>
              <button className="button button--primary" type="submit">Save listing</button>
            </div>
          </form>
        </details>
        <div className="listing-management">
          {listings.map((listing) => (
            <article key={listing.id}>
              <div><span>{listing.status.replaceAll("_", " ")}</span><h2>{listing.title}</h2><p>{listing.city}, {listing.state_code} · {formatMoney(listing.asking_price)}</p><Link href={`/${locale}/dashboard/inbox`}>View buyer activity →</Link></div>
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
