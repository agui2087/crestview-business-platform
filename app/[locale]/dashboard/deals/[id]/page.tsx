import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { dealStages, demoInquiries, demoMarketplaceListings } from "@/lib/marketplace";
import { getCrestviewUser } from "@/lib/current-user";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { addDealRoomDocument, advanceInquiry, createDocumentRequest, decideFinancialAccess, reportMarketplaceItem, requestFinancialAccess, resolveDocumentRequest, sendMessage, sendNda, signNda } from "../../marketplace/actions";

export const metadata: Metadata = { title: "Secure deal workspace" };

type WorkspaceData = {
  inquiry: typeof demoInquiries[number];
  title: string;
  isBuyer: boolean;
  messages: { id: string; body: string; sender_id: string; created_at: string }[];
  nda: { status: string; document_name: string; template_body: string | null; storage_path?: string | null; template_version?: number; signed_at: string | null; signer_name: string | null } | null;
  ndaUrl: string | null;
  documents: { id: string; title: string; category: string; external_url: string | null; secure_url?: string | null; storage_path?: string | null; original_filename?: string | null; mime_type?: string | null; file_size_bytes?: number | null; access_level?: string; permission_note?: string | null; version: number; created_at: string }[];
  requests: { id: string; item_name: string; note: string | null; status: string; document_id: string | null; created_at: string; resolved_at: string | null }[];
  events: { id: string; to_status: string; note: string | null; created_at: string }[];
  listingFinancials?: { asking_price: number | null; annual_revenue: number | null; cash_flow: number | null };
  isDemo: boolean;
};

async function getWorkspace(id: string, userId?: string): Promise<WorkspaceData> {
  if (!userId || !isSupabaseConfigured() || id.startsWith("demo-")) {
    const inquiry = demoInquiries[0];
    return {
      inquiry, title: demoMarketplaceListings[0].title, isBuyer: true, isDemo: true, ndaUrl: null,
      messages: [
        { id: "m1", sender_id: "demo-buyer", body: inquiry.initial_message, created_at: "2026-07-29T09:00:00.000Z" },
        { id: "m2", sender_id: "demo-broker", body: "Thank you for your interest. I have reviewed your request and sent our standard mutual NDA for signature.", created_at: "2026-07-29T10:30:00.000Z" },
      ],
      nda: { status: "sent", document_name: "Mutual confidentiality agreement", template_body: "This mutual confidentiality agreement protects non-public information shared for the purpose of evaluating the potential acquisition.", signed_at: null, signer_name: null },
      documents: [
        { id: "d1", title: "Confidential information memorandum", category: "Offering materials", external_url: null, version: 1, created_at: "2026-07-29T10:40:00.000Z" },
        { id: "d2", title: "Trailing twelve-month P&L", category: "Financial", external_url: null, version: 1, created_at: "2026-07-29T10:42:00.000Z" },
      ],
      requests: [
        { id: "r1", item_name: "Financial statements", note: "Most recent three years and year-to-date.", status: "requested", document_id: null, created_at: "2026-07-29T11:00:00.000Z", resolved_at: null },
        { id: "r2", item_name: "Confidential information memorandum", note: null, status: "fulfilled", document_id: "d1", created_at: "2026-07-29T09:05:00.000Z", resolved_at: "2026-07-29T10:40:00.000Z" },
      ],
      events: [
        { id: "e1", to_status: "submitted", note: "Buyer submitted an information request.", created_at: "2026-07-29T09:00:00.000Z" },
        { id: "e2", to_status: "nda_sent", note: "Broker approved the initial request and sent an NDA.", created_at: "2026-07-29T10:30:00.000Z" },
      ],
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data: inquiry } = await supabase.from("deal_inquiries").select("id,listing_id,buyer_id,broker_id,subject,initial_message,status,updated_at,requested_items,acquisition_experience,funding_readiness,financial_access_status,financial_request_message,financial_request_timeline,financial_request_capital,marketplace_listings(title,city,state_code,asking_price,annual_revenue,cash_flow)").eq("id", id).or(`buyer_id.eq.${userId},broker_id.eq.${userId}`).maybeSingle();
  if (!inquiry) notFound();
  const [{ data: messages }, { data: nda }, { data: documents }, { data: requests }, { data: events }] = await Promise.all([
    supabase.from("deal_messages").select("id,body,sender_id,created_at").eq("inquiry_id", id).order("created_at"),
    supabase.from("deal_ndas").select("status,document_name,template_body,storage_path,template_version,signed_at,signer_name").eq("inquiry_id", id).maybeSingle(),
    supabase.from("deal_room_documents").select("id,title,category,storage_path,original_filename,mime_type,file_size_bytes,external_url,access_level,permission_note,version,created_at").eq("inquiry_id", id).eq("is_active", true).order("created_at"),
    supabase.from("deal_document_requests").select("id,item_name,note,status,document_id,created_at,resolved_at").eq("inquiry_id", id).order("created_at"),
    supabase.from("deal_status_events").select("id,to_status,note,created_at").eq("inquiry_id", id).order("created_at"),
  ]);
  const listing = inquiry.marketplace_listings as unknown as { title: string; asking_price?: number | null; annual_revenue?: number | null; cash_flow?: number | null } | null;
  let ndaUrl: string | null = null;
  if (nda?.storage_path) {
    const { data } = await supabase.storage.from("deal-files").createSignedUrl(nda.storage_path, 60 * 15);
    ndaUrl = data?.signedUrl ?? null;
  }
  const documentsWithUrls = await Promise.all((documents ?? []).map(async (document) => {
    if (!document.storage_path) return { ...document, secure_url: null };
    const { data } = await supabase.storage.from("deal-files").createSignedUrl(document.storage_path, 60 * 15);
    return { ...document, secure_url: data?.signedUrl ?? null };
  }));
  return {
    inquiry: inquiry as unknown as typeof demoInquiries[number], title: listing?.title ?? inquiry.subject,
    isBuyer: inquiry.buyer_id === userId, isDemo: false, messages: messages ?? [], nda, ndaUrl, documents: documentsWithUrls, requests: requests ?? [], events: events ?? [],
    listingFinancials: { asking_price: listing?.asking_price ?? null, annual_revenue: listing?.annual_revenue ?? null, cash_flow: listing?.cash_flow ?? null },
  };
}

export default async function DealWorkspacePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const { locale, id } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const user = await getCrestviewUser(locale);
  let userId: string | undefined;
  if (isSupabaseConfigured() && user.source === "supabase") userId = (await (await createSupabaseServerClient()).auth.getUser()).data.user?.id;
  const workspace = await getWorkspace(id, userId);
  const currentStageIndex = Math.max(0, dealStages.findIndex(([key]) => key === workspace.inquiry.status));
  const roomUnlocked = ["nda_signed","document_review","meeting","offer","closed"].includes(workspace.inquiry.status);
  const financialStatus = workspace.inquiry.financial_access_status ?? "not_requested";
  const financialApproved = financialStatus === "approved";
  const financials = workspace.listingFinancials;
  const priceToCashFlow = financials?.asking_price && financials.cash_flow ? financials.asking_price / financials.cash_flow : null;
  const cashFlowMargin = financials?.annual_revenue && financials.cash_flow ? financials.cash_flow / financials.annual_revenue : null;
  const documentGroups = ["Overview","Financial","Tax","Legal","Employees","Customers","Assets","Closing","Operations"].map((category) => ({
    category,
    documents: workspace.documents.filter((document) => document.category === category || (category === "Overview" && ["Offering materials","Other"].includes(document.category))),
  }));
  const requestedDocumentNames = new Set(workspace.requests.map((request) => request.item_name));
  const availableRequestOptions = [
    "Financial statements", "Business tax returns", "Bank or revenue support",
    "Customer concentration report", "Lease and amendments", "Employee census",
    "Equipment and asset list", "Material contracts", "Licenses and permits",
    "Other supporting document",
  ].filter((item) => !requestedDocumentNames.has(item));
  return (
    <PlatformShell locale={locale} active="inbox">
      <div className="dashboard-content deal-room-page">
        <div className="workspace-back"><Link href={`/${locale}/dashboard/inbox`}>← Back to deal inbox</Link><span>Private workspace</span></div>
        <PageHeading eyebrow="Secure deal workspace" title={workspace.title} body="Sign the NDA, request records, and keep every conversation and document together." />
        {query.nda && <p className="notice">The NDA was {query.nda === "signed" ? "signed and the deal room is unlocked" : "sent successfully"}.</p>}
        {query.financial && <p className="notice">{query.financial === "requested" ? "Your financial-information request was sent to the broker." : `Financial access was updated: ${String(query.financial).replaceAll("_", " ")}.`}</p>}
        {workspace.isDemo && <p className="data-notice"><strong>Interactive preview</strong><span>This example shows the complete workflow. Live broker-created listings use the same protected workspace and database permissions.</span></p>}
        <nav className="deal-workspace-nav" aria-label="Deal workspace sections">
          <a href="#deal-overview">Overview</a><a href="#deal-conversation">Messages &amp; NDA</a><a href="#deal-documents">Documents</a><a href="#deal-activity">Activity</a><a href="#deal-stage">Deal stage</a>
        </nav>
        <section className="deal-workspace-section" id="deal-overview">
        <div className="deal-overview-strip">
          <div><span>Current stage</span><strong>{dealStages[currentStageIndex]?.[1] ?? "Inquiry sent"}</strong></div>
          <div><span>Your role</span><strong>{workspace.isBuyer ? "Buyer" : "Broker / seller"}</strong></div>
          <div><span>Next action</span><strong>{workspace.isBuyer
            ? workspace.inquiry.status === "nda_sent"
              ? "Sign the NDA"
              : roomUnlocked && financialStatus === "not_requested"
                ? "Request financial access"
                : financialStatus === "requested"
                  ? "Wait for broker review"
                  : financialApproved
                    ? "Review approved documents"
                    : "Continue screening"
            : workspace.inquiry.status === "nda_sent"
              ? "Wait for the buyer’s signature"
              : financialStatus === "requested"
                ? "Review the financial request"
                : financialApproved
                  ? "Release approved documents"
                  : "Continue buyer screening"}</strong></div>
        </div>
        <div className="deal-simple-flow" aria-label="Deal room steps">
          <div className={roomUnlocked ? "is-done" : "is-current"}><span>{roomUnlocked ? "✓" : "1"}</span><div><strong>{workspace.isBuyer ? "Sign NDA" : "Buyer signs NDA"}</strong><small>{workspace.isBuyer ? "Review and accept the listing agreement" : "Crestview delivers and records the agreement"}</small></div></div>
          <div className={financialApproved ? "is-done" : roomUnlocked ? "is-current" : ""}><span>{financialApproved ? "✓" : "2"}</span><div><strong>{workspace.isBuyer ? "Request records" : "Review buyer request"}</strong><small>{workspace.isBuyer ? "The broker decides what to release" : "Approve, ask a question, or decline"}</small></div></div>
          <div className={financialApproved ? "is-current" : ""}><span>3</span><div><strong>{workspace.isBuyer ? "Review securely" : "Release securely"}</strong><small>Use the deal room and conversation</small></div></div>
        </div>
        </section>
        <section className="deal-workspace-section" id="deal-conversation">
          <div className="deal-section-heading"><span>Communication</span><h2>Messages and confidentiality</h2><p>Keep buyer questions and NDA progress together.</p></div>
        <div className="deal-room-grid">
          <section className="panel deal-thread">
            <div className="panel__header"><h2>Conversation</h2><span className="stage">{workspace.inquiry.status.replaceAll("_", " ")}</span></div>
            {workspace.messages.map((message) => <article className={message.sender_id === (userId ?? "demo-buyer") ? "is-mine" : ""} key={message.id}><strong>{message.sender_id === (userId ?? "demo-buyer") ? "You" : "Deal participant"}</strong><p>{message.body}</p><span>{new Date(message.created_at).toLocaleString()}</span></article>)}
            {!workspace.isDemo && <form className="quick-reply" action={sendMessage}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} /><textarea name="body" placeholder="Write a secure message…" required /><button className="button button--primary" type="submit">Send</button></form>}
          </section>
          <aside className="panel nda-card">
            <div className="panel__header"><h2>Confidentiality agreement</h2><span className="stage">{workspace.nda?.status ?? "not sent"}</span></div>
            {workspace.nda ? <>
              <strong>{workspace.nda.document_name}</strong>
              <p>{workspace.nda.template_body ?? "The broker-provided agreement is stored securely with this deal."}</p>
              {workspace.ndaUrl && <a className="nda-document-link" href={workspace.ndaUrl} target="_blank" rel="noreferrer">Open the complete NDA PDF ↗</a>}
              {workspace.nda.template_version && <small>Document version {workspace.nda.template_version}</small>}
              {workspace.nda.signed_at && <small>Signed by {workspace.nda.signer_name} on {new Date(workspace.nda.signed_at).toLocaleDateString()}</small>}
              {workspace.isBuyer && workspace.nda.status === "sent" && !workspace.isDemo && <form action={signNda}>
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
                <label>Type your full legal name<input name="signer_name" required /></label>
                <label className="signature-consent"><input type="checkbox" name="accepted" required /> I have reviewed and agree to sign this NDA electronically.</label>
                <button className="button button--primary" type="submit">Sign NDA</button>
              </form>}
              {workspace.isDemo && <button className="button button--primary" type="button" disabled>Sign NDA in live workspace</button>}
            </> : !workspace.isBuyer && !workspace.isDemo ? <form action={sendNda}>
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
              <label>Agreement name<input name="document_name" defaultValue="Mutual confidentiality agreement" required /></label>
              <label>Agreement terms<textarea name="template_body" defaultValue="The parties agree to protect non-public information shared solely for evaluating the potential acquisition described in this workspace." required /></label>
              <button className="button button--primary" type="submit">Send NDA for signature</button>
            </form> : <p>The broker has not sent an NDA yet.</p>}
          </aside>
        </div>
        </section>
        {roomUnlocked && <section className="panel financial-access-panel">
          <div className="panel__header"><div><span className="source-label">Step 2</span><h2>Request business records</h2></div><span className={`stage financial-${financialStatus}`}>{financialStatus.replaceAll("_", " ")}</span></div>
          {workspace.isBuyer && financialStatus === "not_requested" && !workspace.isDemo && <form action={requestFinancialAccess}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
            <p>Choose what you need for an initial review. The broker can approve, ask a question, or decline.</p>
            <fieldset><legend>What would you like to review?</legend>
              {[
                ["Financial statements", "Profit and loss statements and balance sheets"],
                ["Tax returns", "Recent business tax returns"],
                ["Revenue support", "Bank, sales, or customer concentration support"],
                ["Operations", "Payroll, equipment, contracts, and operating records"],
              ].map(([item, help], index) => <label key={item}><input type="checkbox" name="financial_requested_items" value={item} defaultChecked={index < 2} /><span><strong>{item}</strong><small>{help}</small></span></label>)}
            </fieldset>
            <div className="financial-request-grid">
              <label>When might you buy?<select name="financial_request_timeline" defaultValue="Within 6 months"><option>Within 90 days</option><option>Within 6 months</option><option>Within 12 months</option><option>Just exploring</option></select></label>
              <label>How would you fund it?<select name="financial_request_capital" defaultValue="Exploring financing"><option>Cash or proof of funds available</option><option>Prequalified with a lender</option><option>Exploring financing</option><option>Interested in seller financing</option></select></label>
            </div>
            <label>Short note to the broker<textarea name="financial_request_message" minLength={20} placeholder="Example: I operate a similar business and hope to buy within six months. I would like to confirm earnings before scheduling a call." required /></label>
            <button className="button button--primary" type="submit">Send request</button>
          </form>}
          {workspace.isBuyer && financialStatus === "requested" && <div className="financial-status-message"><strong>Request awaiting broker review</strong><p>The broker can approve access, request more information, or decline. You will receive a notification when they decide.</p></div>}
          {workspace.isBuyer && financialStatus === "more_information" && <div className="financial-status-message"><strong>The broker needs more information</strong><p>Use the secure conversation above to answer the broker’s questions, then submit an updated request.</p></div>}
          {workspace.isBuyer && financialApproved && <div className="financial-status-message is-approved"><strong>Financial access approved</strong><p>Documents labeled “Broker approval required” are now available in the secure deal room.</p></div>}
          {workspace.isBuyer && financialStatus === "declined" && <div className="financial-status-message"><strong>Access was not approved</strong><p>You can continue the conversation, but confidential financial records remain restricted.</p></div>}
          {!workspace.isBuyer && financialStatus === "requested" && <div className="broker-financial-review">
            <div><span>Buyer readiness</span><strong>{workspace.inquiry.financial_request_capital}</strong><small>{workspace.inquiry.financial_request_timeline}</small></div>
            <div><span>Requested documents</span><strong>{workspace.inquiry.requested_items?.join(", ") || "Not specified"}</strong></div>
            <blockquote>{workspace.inquiry.financial_request_message}</blockquote>
            <form action={decideFinancialAccess}>
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
              <button name="decision" value="more_information" className="button button--light" type="submit">Request more information</button>
              <button name="decision" value="declined" className="button button--light" type="submit">Decline</button>
              <button name="decision" value="approved" className="button button--primary" type="submit">Approve financial access</button>
            </form>
          </div>}
          {!workspace.isBuyer && financialStatus !== "requested" && <div className="financial-status-message"><strong>{financialApproved ? "Financial access is approved" : "No financial request needs review"}</strong><p>NDA delivery is automatic. You are only interrupted when a signed buyer requests sensitive financial information.</p></div>}
          {workspace.isDemo && <div className="financial-status-message"><strong>Financial requests remain manual</strong><p>Live buyers submit readiness information after signing. The broker then chooses whether to release approved documents.</p></div>}
        </section>}
        {roomUnlocked && <section className="panel financial-review-summary">
          <div className="panel__header"><div><span className="source-label">Guided review</span><h2>Financial snapshot</h2></div><span className="stage">{financialApproved ? "Records approved" : "Public figures only"}</span></div>
          <div className="financial-review-metrics">
            <div><span>Asking price</span><strong>{financials?.asking_price ? `$${financials.asking_price.toLocaleString()}` : "Not provided"}</strong></div>
            <div><span>Revenue</span><strong>{financials?.annual_revenue ? `$${financials.annual_revenue.toLocaleString()}` : "Not provided"}</strong></div>
            <div><span>Cash flow / SDE</span><strong>{financials?.cash_flow ? `$${financials.cash_flow.toLocaleString()}` : "Not provided"}</strong></div>
            <div><span>Price ÷ cash flow</span><strong>{priceToCashFlow ? `${priceToCashFlow.toFixed(2)}×` : "Needs records"}</strong></div>
            <div><span>Cash-flow margin</span><strong>{cashFlowMargin ? `${Math.round(cashFlowMargin * 100)}%` : "Needs records"}</strong></div>
            <div><span>Supporting documents</span><strong>{workspace.documents.length}</strong></div>
          </div>
          <p>Use these figures as a starting point. Reconcile them with tax returns, statements, and source records before relying on them.</p>
        </section>}
        <section className="deal-workspace-section" id="deal-documents">
          <div className="deal-section-heading"><span>Due diligence</span><h2>Requests and secure documents</h2><p>Track what has been requested, received, and approved.</p></div>
        {(roomUnlocked || workspace.isDemo) && <section className="panel request-tracker">
          <div className="panel__header"><div><span className="source-label">Shared checklist</span><h2>Document requests</h2></div><span className="stage">{workspace.requests.filter((request) => request.status === "requested").length} open</span></div>
          <p className="request-tracker__intro">Buyers request only what they need. Brokers can fulfill each item with a secure upload or mark it unavailable.</p>
          <div className="request-tracker__list">
            {workspace.requests.map((request) => <article className={`is-${request.status}`} key={request.id}>
              <span>{request.status === "fulfilled" ? "✓" : request.status === "not_available" ? "—" : "○"}</span>
              <div><strong>{request.item_name}</strong><p>{request.note || (request.status === "fulfilled" ? "Document added to this room." : request.status === "not_available" ? "Broker marked this item unavailable." : "Waiting for the broker.")}</p></div>
              <small>{request.status.replaceAll("_", " ")}</small>
              {!workspace.isBuyer && !workspace.isDemo && request.status === "requested" && <form action={resolveDocumentRequest}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} /><input type="hidden" name="request_id" value={request.id} /><button type="submit">Mark unavailable</button></form>}
            </article>)}
            {!workspace.requests.length && <p className="panel-empty">No specific documents have been requested yet.</p>}
          </div>
          {workspace.isBuyer && !workspace.isDemo && availableRequestOptions.length > 0 && <details className="request-tracker__add"><summary>Request another document</summary><form action={createDocumentRequest}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
            <label>Document<select name="item_name" defaultValue={availableRequestOptions[0]}>{availableRequestOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Optional note<input name="note" maxLength={500} placeholder="Example: three years plus year-to-date" /></label>
            <button className="button button--primary" type="submit">Add request</button>
          </form></details>}
        </section>}
        <section className={`panel secure-room ${roomUnlocked || workspace.isDemo ? "is-unlocked" : "is-locked"}`}>
          <div className="panel__header"><div><span className="source-label">Permission-controlled documents</span><h2>Secure deal room</h2></div><span className="stage">{roomUnlocked ? financialApproved ? "Financial access approved" : "NDA access only" : "NDA required"}</span></div>
          {!roomUnlocked && !workspace.isDemo && <div className="room-lock"><span>🔒</span><h3>Sign the NDA to unlock documents</h3><p>Only approved participants can access confidential materials. Every upload and status change remains attached to this deal.</p></div>}
          {(roomUnlocked || workspace.isDemo) && <div className="document-folders">{documentGroups.map((group) => <section className={group.documents.length ? "" : "is-missing"} key={group.category}><header><strong>{group.category}</strong><span>{group.documents.length ? `${group.documents.length} received` : "Missing"}</span></header>{group.documents.length ? <div className="room-documents">{group.documents.map((document) => <article key={document.id}><span>▤</span><div><strong>{document.title}</strong><small>{document.original_filename || "Secure record"} · Version {document.version} · {document.permission_note ?? (document.access_level === "approved" ? "Broker approval required" : document.access_level === "broker_only" ? "Broker only" : "Available after NDA")}</small></div>{document.secure_url || document.external_url ? <a href={document.secure_url || document.external_url || "#"} target="_blank" rel="noreferrer">Open securely</a> : <span className="stage">Protected</span>}</article>)}</div> : <p className="folder-missing-note">No document received yet. Add it to the request list if it is material to this deal.</p>}</section>)}</div>}
          {!workspace.isBuyer && !workspace.isDemo && <details className="room-upload"><summary>Add a secure document</summary><form action={addDealRoomDocument}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
            <label>Title<input name="title" placeholder="Document title" required /></label><label>Folder<select name="category"><option>Overview</option><option>Financial</option><option>Tax</option><option>Legal</option><option>Employees</option><option>Customers</option><option>Assets</option><option>Closing</option><option>Operations</option><option>Other</option></select></label>
            <label>Upload file<input name="document_file" type="file" accept=".pdf,.csv,.xls,.xlsx,.doc,.docx" /></label><label>Or secure link<input name="external_url" type="url" placeholder="https://" /></label><label>Buyer access<select name="access_level"><option value="nda_signed">Available after NDA</option><option value="approved">Broker approval required</option><option value="broker_only">Broker only</option></select></label>
            {workspace.requests.some((request) => request.status === "requested") && <label>Fulfills request<select name="request_id"><option value="">None</option>{workspace.requests.filter((request) => request.status === "requested").map((request) => <option value={request.id} key={request.id}>{request.item_name}</option>)}</select></label>}
            <button className="button button--primary" type="submit">Add document</button>
            <small>PDF, CSV, Excel, or Word · maximum 20 MB. Files stay private and follow the access level above.</small>
          </form></details>}
        </section>
        </section>
        <div className="deal-bottom-grid">
          <details className="panel deal-secondary-panel" id="deal-activity"><summary><span><strong>Activity history</strong><small>{workspace.events.length} recorded update{workspace.events.length === 1 ? "" : "s"}</small></span><b>View</b></summary><div className="deal-timeline">{workspace.events.map((event) => <article key={event.id}><span>✓</span><div><strong>{event.to_status.replaceAll("_", " ")}</strong><p>{event.note ?? "Deal status updated."}</p><small>{new Date(event.created_at).toLocaleString()}</small></div></article>)}</div></details>
          <section className="panel" id="deal-stage"><div className="panel__header"><h2>Move the deal forward</h2></div><p className="panel-empty">Keep the stage current so both participants know what happens next.</p>{!workspace.isDemo && <form className="status-control" action={advanceInquiry}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
            <select name="status">{dealStages.slice(1).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select>
            <button className="button button--primary" type="submit">Update stage</button>
          </form>}</section>
        </div>
        {!workspace.isDemo && <details className="trust-report">
          <summary>Report a concern about this listing or participant</summary>
          <form action={reportMarketplaceItem}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="inquiry_id" value={id} />
            <input type="hidden" name="listing_id" value={workspace.inquiry.listing_id} />
            <label>Reason<select name="reason" required><option value="incorrect_information">Inaccurate information</option><option value="suspicious_activity">Suspicious behavior</option><option value="confidentiality">Document or confidentiality concern</option><option value="other">Other</option></select></label>
            <label>What happened?<textarea name="details" minLength={10} required /></label>
            <button className="button button--light" type="submit">Send report for review</button>
          </form>
        </details>}
      </div>
    </PlatformShell>
  );
}
