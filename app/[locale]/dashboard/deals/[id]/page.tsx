import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { dealStages, demoInquiries, demoMarketplaceListings } from "@/lib/marketplace";
import { getCrestviewUser } from "@/lib/current-user";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { addDealRoomDocument, advanceInquiry, sendMessage, sendNda, signNda } from "../../marketplace/actions";

export const metadata: Metadata = { title: "Secure deal workspace" };

type WorkspaceData = {
  inquiry: typeof demoInquiries[number];
  title: string;
  isBuyer: boolean;
  messages: { id: string; body: string; sender_id: string; created_at: string }[];
  nda: { status: string; document_name: string; template_body: string | null; signed_at: string | null; signer_name: string | null } | null;
  documents: { id: string; title: string; category: string; external_url: string | null; version: number; created_at: string }[];
  events: { id: string; to_status: string; note: string | null; created_at: string }[];
  isDemo: boolean;
};

async function getWorkspace(id: string, userId?: string): Promise<WorkspaceData> {
  if (!userId || !isSupabaseConfigured() || id.startsWith("demo-")) {
    const inquiry = demoInquiries[0];
    return {
      inquiry, title: demoMarketplaceListings[0].title, isBuyer: true, isDemo: true,
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
  const { data: inquiry } = await supabase.from("deal_inquiries").select("id,listing_id,buyer_id,broker_id,subject,initial_message,status,updated_at,marketplace_listings(title,city,state_code)").eq("id", id).or(`buyer_id.eq.${userId},broker_id.eq.${userId}`).maybeSingle();
  if (!inquiry) return getWorkspace("demo-inquiry");
  const [{ data: messages }, { data: nda }, { data: documents }, { data: events }] = await Promise.all([
    supabase.from("deal_messages").select("id,body,sender_id,created_at").eq("inquiry_id", id).order("created_at"),
    supabase.from("deal_ndas").select("status,document_name,template_body,signed_at,signer_name").eq("inquiry_id", id).maybeSingle(),
    supabase.from("deal_room_documents").select("id,title,category,external_url,version,created_at").eq("inquiry_id", id).eq("is_active", true).order("created_at"),
    supabase.from("deal_status_events").select("id,to_status,note,created_at").eq("inquiry_id", id).order("created_at"),
  ]);
  const listing = inquiry.marketplace_listings as unknown as { title: string } | null;
  return {
    inquiry: inquiry as unknown as typeof demoInquiries[number], title: listing?.title ?? inquiry.subject,
    isBuyer: inquiry.buyer_id === userId, isDemo: false, messages: messages ?? [], nda, documents: documents ?? [], events: events ?? [],
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
  return (
    <PlatformShell locale={locale} active="inbox">
      <div className="dashboard-content deal-room-page">
        <PageHeading eyebrow="Secure deal workspace" title={workspace.title} body="One protected record for messages, NDA activity, confidential documents, and every step toward a possible offer." />
        {query.nda && <p className="notice">The NDA was {query.nda === "signed" ? "signed and the deal room is unlocked" : "sent successfully"}.</p>}
        {workspace.isDemo && <p className="data-notice"><strong>Interactive preview</strong><span>This example shows the complete workflow. Live broker-created listings use the same protected workspace and database permissions.</span></p>}
        <div className="deal-stage-rail">
          {dealStages.map(([key,label], index) => <div className={index <= currentStageIndex ? "is-complete" : ""} key={key}><span>{index < currentStageIndex ? "✓" : index + 1}</span><strong>{label}</strong></div>)}
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
        <section className={`panel secure-room ${roomUnlocked || workspace.isDemo ? "is-unlocked" : "is-locked"}`}>
          <div className="panel__header"><div><span className="source-label">Permission-controlled documents</span><h2>Secure deal room</h2></div><span className="stage">{roomUnlocked ? "Unlocked" : "NDA required"}</span></div>
          {!roomUnlocked && !workspace.isDemo && <div className="room-lock"><span>🔒</span><h3>Sign the NDA to unlock documents</h3><p>Only approved participants can access confidential materials. Every upload and status change remains attached to this deal.</p></div>}
          {(roomUnlocked || workspace.isDemo) && <div className="room-documents">{workspace.documents.map((document) => <article key={document.id}><span>▤</span><div><strong>{document.title}</strong><small>{document.category} · Version {document.version}</small></div>{document.external_url ? <a href={document.external_url} target="_blank" rel="noreferrer">Open</a> : <span className="stage">Protected</span>}</article>)}</div>}
          {!workspace.isBuyer && !workspace.isDemo && <details className="room-upload"><summary>Add a secure document</summary><form action={addDealRoomDocument}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={id} />
            <input name="title" placeholder="Document title" required /><select name="category"><option>Financial</option><option>Offering materials</option><option>Legal</option><option>Operations</option><option>Other</option></select>
            <input name="external_url" type="url" placeholder="Secure document URL (optional)" /><select name="access_level"><option value="nda_signed">After NDA signature</option><option value="approved">Approved buyer</option><option value="broker_only">Broker only</option></select>
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
