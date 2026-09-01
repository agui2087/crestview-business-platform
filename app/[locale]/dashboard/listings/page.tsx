import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { FormattedMoneyInput } from "@/components/formatted-money-input";
import { getCrestviewUser } from "@/lib/current-user";
import { formatMoney, getMyListings } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { confirmListingAvailability, createListing, updateListingStatus } from "../marketplace/actions";

export const metadata: Metadata = { title: "Broker listings" };

export default async function ListingsPage({ params, searchParams }: PageProps<"/[locale]/dashboard/listings">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const user = await getCrestviewUser(locale);
  let userId: string | undefined;
  let inquiryCount = 0;
  let awaitingSignatureCount = 0;
  if (isSupabaseConfigured() && user.source === "supabase") {
    const supabase = await createSupabaseServerClient();
    userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      const [{ count: inquiries }, { count: awaiting }] = await Promise.all([
        supabase.from("deal_inquiries").select("id", { count: "exact", head: true }).eq("broker_id", userId),
        supabase.from("deal_inquiries").select("id", { count: "exact", head: true }).eq("broker_id", userId).eq("status", "nda_sent"),
      ]);
      inquiryCount = inquiries ?? 0;
      awaitingSignatureCount = awaiting ?? 0;
    }
  }
  const listings = await getMyListings(userId);
  const freshnessCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const activeListings = listings.filter((item) => ["published", "under_offer"].includes(item.status));
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
        {query.confirmed && <p className="notice">Availability confirmed. Buyers can continue finding this listing for another 30 days.</p>}
        {query.duplicate && <p className="auth-error">Possible duplicate detected. Your listing was saved, but please compare it with your existing listings and pause or remove any duplicate.</p>}
        {query.error === "limit" && <p className="auth-error">You have reached the limit of 100 active listings. Pause, sell, or withdraw one before publishing another.</p>}
        {query.error === "nda_required" && <p className="auth-error">Add an approved PDF NDA and confirm you are authorized to use it before publishing. You can keep the listing as a draft until then.</p>}
        {query.error === "nda_file" && <p className="auth-error">The NDA must be a PDF no larger than 10 MB.</p>}
        {query.error === "nda_upload" && <p className="auth-error">The NDA could not be uploaded. Your listing was not published. Please try the upload again.</p>}
        {typeof query.error === "string" && !["limit", "nda_required", "nda_file", "nda_upload"].includes(query.error) && <p className="auth-error">We could not save that listing. Review the required fields and try again.</p>}
        <div className="broker-summary">
          <article><span>Total listings</span><strong>{listings.length}</strong></article>
          <article><span>Active listings</span><strong>{activeListings.length} / 100</strong></article>
          <article><span>Buyer inquiries</span><strong>{inquiryCount}</strong></article>
          <article><span>Awaiting signature</span><strong>{awaitingSignatureCount}</strong></article>
        </div>
        <div className="broker-flow">
          <span><strong>1</strong> Create the listing</span>
          <span><strong>2</strong> Add your standard NDA</span>
          <span><strong>3</strong> Review serious buyers</span>
        </div>
        {!listings.length && <section className="broker-first-listing">
          <div><span className="source-label">Start here</span><h2>Create your first listing</h2><p>Save the public facts first, then add your approved NDA before publishing. Crestview will deliver that NDA automatically so routine requests do not fill your inbox.</p></div>
          <a className="button button--primary" href="#new-listing">Start listing setup</a>
        </section>}
        <details className="listing-editor" id="new-listing" open={!listings.length || query.new === "1"}>
          <summary><span><strong>Create a new listing</strong><small>Required public details are marked below. Save a draft anytime; an approved NDA is required before publishing.</small></span><b>+</b></summary>
          <form action={createListing}>
            <input type="hidden" name="locale" value={locale} />
            <div className="form-section-heading"><span>01</span><div><strong>Public listing details</strong><small>Buyers can see these fields before requesting access.</small></div></div>
            <div className="listing-form-grid">
              <label className="span-two">Listing title <small>Required</small><input name="title" placeholder="Established commercial services company" minLength={5} maxLength={140} required /></label>
              <label>Industry <small>Required</small><input name="industry" placeholder="Commercial Services" required /></label>
              <label>City <small>Required</small><input name="city" placeholder="Portland" required /></label>
              <label>State <small>Required</small><input name="state_code" placeholder="OR" minLength={2} maxLength={2} required /></label>
              <label>Asking price<FormattedMoneyInput name="asking_price" placeholder="$1,250,000" /></label>
              <label>Annual revenue<FormattedMoneyInput name="annual_revenue" placeholder="$2,100,000" /></label>
              <label>Cash flow / SDE<FormattedMoneyInput name="cash_flow" placeholder="$425,000" /></label>
              <label className="span-two">Public summary <small>Required</small><textarea name="summary" placeholder="Describe the business without exposing confidential details." minLength={20} required /></label>
              <label className="span-two">Public highlights<textarea name="public_highlights" placeholder={"Recurring customer contracts\nExperienced management team\nSeller transition available"} /></label>
            </div>
            <div className="form-section-heading nda-automation"><span>02</span><div><strong>Add your NDA</strong><small>Upload it once. Buyers can review and sign it without waiting for you.</small></div></div>
            <div className="nda-template-editor">
              <label className="span-three nda-upload-primary">Upload your approved NDA
                <input name="nda_file" type="file" accept="application/pdf,.pdf" />
                <small>PDF only, up to 10 MB. Crestview records exactly which version each buyer signs.</small>
              </label>
              <label className="nda-confirmation span-three"><input type="checkbox" name="nda_attested" /> I am authorized to use this NDA and have had it reviewed for this listing. <small>Required to publish</small></label>
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
              <div><strong>Choose what happens next</strong><small>A draft stays private. Publishing makes the listing searchable and activates automatic NDA delivery.</small></div>
              <button className="button button--light" name="listing_action" value="draft" type="submit">Save draft</button>
              <button className="button button--primary" name="listing_action" value="publish" type="submit">Publish listing</button>
            </div>
          </form>
        </details>
        <div className="listing-management">
          {listings.map((listing) => (
            <article key={listing.id}>
              <div><span>{listing.status.replaceAll("_", " ")}</span><h2>{listing.title}</h2><p>{listing.city}, {listing.state_code} · {formatMoney(listing.asking_price)}</p><div className="listing-quality-meter"><i><b style={{ width: `${listing.quality_score ?? 70}%` }} /></i><small>{listing.quality_score ?? 70}% listing quality</small>{(listing.quality_score ?? 70) < 90 && <em>Add complete financials, highlights, and an automatic NDA to improve buyer confidence.</em>}</div><Link href={`/${locale}/dashboard/inbox`}>View buyer activity →</Link></div>
              {!listing.id.startsWith("demo-") && <form className="listing-status-form" action={updateListingStatus}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="listing_id" value={listing.id} />
                <label>Status<select name="status" defaultValue={listing.status}>
                  <option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option>
                  <option value="under_offer">Under offer</option><option value="sold">Sold</option><option value="withdrawn">Withdrawn</option>
                </select></label>
                <button type="submit">Update</button>
              </form>}
              {!listing.id.startsWith("demo-") && ["published", "under_offer"].includes(listing.status) && <form action={confirmListingAvailability}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="listing_id" value={listing.id} />
                <small>{new Date(listing.updated_at).getTime() >= freshnessCutoff ? `Confirmed ${new Date(listing.updated_at).toLocaleDateString()}` : "Confirmation overdue—hidden from buyer search"}</small>
                <button type="submit">Confirm availability</button>
              </form>}
              {listing.id.startsWith("demo-") && <span className="stage">Example listing</span>}
            </article>
          ))}
        </div>
      </div>
    </PlatformShell>
  );
}
