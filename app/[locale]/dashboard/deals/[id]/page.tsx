import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { dealStages, demoInquiries, demoMarketplaceListings } from "@/lib/marketplace";
import { getCrestviewUser } from "@/lib/current-user";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { addDealRoomDocument, advanceInquiry, decideFinancialAccess, requestFinancialAccess, sendMessage, sendNda, signNda } from "../../marketplace/actions";

export const metadata: Metadata = { title: "Secure deal workspace" };

type WorkspaceData = {
  inquiry: typeof demoInquiries[number];
  title: string;
  isBuyer: boolean;
  messages: { id: string; body: string; sender_id: string; created_at: string }[];
  nda: { status: string; document_name: string; template_body: string | null; storage_path?: string | null; template_version?: number; signed_at: string | null; signer_name: string | null } | null;
  ndaUrl: string | null;
  documents: { id: string; title: string; category: string; external_url: string | null; version: number; created_at: string }[];
  events: { id: string; to_status: string; note: string | null; created_at: string }[];
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
      events: [
        { id: "e1", to_status: "submitted", note: "Buyer submitted an information request.", created_at: "2026-07-29T09:00:00.000Z" },
        { id: "e2", to_status: "nda_sent", note: "Broker approved the initial request and sent an NDA.", created_at: "2026-07-29T10:30:00.000Z" },
      ],
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data: inquiry } = await supabase.from("deal_inquiries").select("id,listing_id,buyer_id,broker_id,subject,initial_message,status,updated_at,requested_items,acquisition_experience,funding_readiness,financial_access_status,financial_request_message,financial_request_timeline,financial_request_capital,marketplace_listings(title,city,state_code)").eq("id", id).or(`buyer_id.eq.${userId},broker_id.eq.${userId}`).maybeSingle();
  if (!inquiry) return getWorkspace("demo-inquiry");
  const [{ data: messages }, { data: nda }, { data: documents }, { data: events }] = await Promise.all([
    supabase.from("deal_messages").select("id,body,sender_id,created_at").eq("inquiry_id", id).order("created_at"),
    supabase.from("deal_ndas").select("status,document_name,template_body,storage_path,template_version,signed_at,signer_name").eq("inquiry_id", id).maybeSingle(),
    supabase.from("deal_room_documents").select("id,title,category,external_url,version,created_at").eq("inquiry_id", id).eq("is_active", true).order("created_at"),
    supabase.from("deal_status_events").select("id,to_status,note,created_at").eq("inquiry_id", id).order("created_at"),
  ]);
  const listing = inquiry.marketplace_listings as unknown as { title: string } | null;
  let ndaUrl: string | null = null;
  if (nda?.storage_path) {
    const { data } = await supabase.storage.from("deal-files").createSignedUrl(nda.storage_path, 60 * 15);
    ndaUrl = data?.signedUrl ?? null;
  }
  return {
    inquiry: inquiry as unknown as typeof demoInquiries[number], title: listing?.title ?? inquiry.subject,
    isBuyer: inquiry.buyer_id === userId, isDemo: false, messages: messages ?? [], nda, ndaUrl, documents: documents ?? [], events: events ?? [],
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
  return (
    <PlatformShell locale={locale} active="inbox">
      <div className="dashboard-content deal-room-page">
        <div className="workspace-back"><Link href={`/${locale}/dashboard/inbox`}>← Back to deal inbox</Link><span>Private workspace</span></div>
        <PageHeading eyebrow="Secure deal workspace" title={workspace.title} body="Sign the NDA, request records, and keep every conversation and document together." />
        {query.nda && <p className="notice">The NDA was {query.nda === "signed" ? "signed and the deal room is unlocked" : "sent successfully"}.</p>}
        {query.financial && <p className="notice">{query.financial === "requested" ? "Your financial-information request was sent to the broker." : `Financial access was updated: ${String(query.financial).replaceAll("_", " ")}.`}</p>}
        {workspace.isDemo && <p className="data-notice"><strong>Interactive preview</strong><span>This example shows the complete workflow. Live broker-created listings use the same protected workspace and database permissions.</span></p>}
        <div className="deal-overview-strip">
          <div><span>Current stage</span><strong>{dealStages[currentStageIndex]?.[1] ?? "Inquiry sent"}</strong></div>
          <div><span>Your role</span><strong>{workspace.isBuyer ? "Buyer" : "Broker / seller"}</strong></div>
          <div><span>Next action</span><strong>{workspace.inquiry.status === "nda_sent" ? "Sign the NDA" : workspace.isBuyer && roomUnlocked && financialStatus === "not_requested" ? "Request financial access" : financialStatus === "requested" ? "Broker reviews financial request" : financialApproved ? "Review approved documents" : "Continue screening"}</strong></div>
        </div>
        <div className="deal-simple-flow" aria-label="Deal room steps">
          <div className={roomUnlocked ? "is-done" : "is-current"}><span>{roomUnlocked ? "✓" : "1"}</span><div><strong>Sign NDA</strong><small>Review and accept the listing agreement</small></div></div>
          <div className={financialApproved ? "is-done" : roomUnlocked ? "is-current" : ""}><span>{financialApproved ? "✓" : "2"}</span><div><strong>Request records</strong><small>The broker decides what to release</small></div></div>
          <div className={financialApproved ? "is-current" : ""}><span>3</span><div><strong>Review securely</strong><small>Use the deal room and conversation</small></div></div>
        </div>
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
        <section className={`panel secure-room ${roomUnlocked || workspace.isDemo ? "is-unlocked" : "is-locked"}`}>
          <div className="panel__header"><div><span className="source-label">Permission-controlled documents</span><h2>Secure deal room</h2></div><span className="stage">{roomUnlocked ? financialApproved ? "Financial access approved" : "NDA access only" : "NDA required"}</span></div>
          {!roomUnlocked && !workspace.isDemo && <div className="room-lock"><span>🔒</span><h3>Sign the NDA to unlock documents</h3><p>Only approved participants can access confidential materials. Every upload and status change remains attached to this deal.</p></div>}
          {(roomUnlocked || workspace.isDemo) && <div className="room-documents">{workspace.documents.map((document) => <article key={document.id}><span>▤</span><div><strong>{document.title}</strong><small>{document.category} · Version {document.version}</small></div>{document.external_url ? <a href={document.external_url} target="_blank" rel="noreferrer">Open</a> : <span className="stage">Protected</span>}</article>)}</div>}
          {!workspace.isBuyer && !workspace.isDemo && <details className="room-upload"><summary>Add a secure document</summary><form action={addDealRoomDocument}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
            <input name="title" placeholder="Document title" required /><select name="category"><option>Financial</option><option>Offering materials</option><option>Legal</option><option>Operations</option><option>Other</option></select>
            <input name="external_url" type="url" placeholder="Secure document URL (optional)" /><select name="access_level"><option value="nda_signed">Available after NDA</option><option value="approved">Broker approval required</option><option value="broker_only">Broker only</option></select>
            <button className="button button--primary" type="submit">Add document</button>
          </form></details>}
        </section>
        <div className="deal-bottom-grid">
          <section className="panel"><div className="panel__header"><h2>Activity history</h2></div><div className="deal-timeline">{workspace.events.map((event) => <article key={event.id}><span>✓</span><div><strong>{event.to_status.replaceAll("_", " ")}</strong><p>{event.note ?? "Deal status updated."}</p><small>{new Date(event.created_at).toLocaleString()}</small></div></article>)}</div></section>
          <section className="panel"><div className="panel__header"><h2>Move the deal forward</h2></div><p className="panel-empty">Keep the stage current so both participants know what happens next.</p>{!workspace.isDemo && <form className="status-control" action={advanceInquiry}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
            <select name="status">{dealStages.slice(1).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select>
            <button className="button button--primary" type="submit">Update stage</button>
          </form>}</section>
        </div>
      </div>
    </PlatformShell>
  );
}
