import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getCrestviewUser } from "@/lib/current-user";
import { getMyInquiries } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { advanceInquiry, markNotificationRead, sendMessage } from "../marketplace/actions";

export const metadata: Metadata = { title: "Deal inbox" };

export default async function InboxPage({ params, searchParams }: PageProps<"/[locale]/dashboard/inbox">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const user = await getCrestviewUser(locale);
  let userId: string | undefined;
  let notifications: { id: string; title: string; body: string; inquiry_id: string | null; read_at: string | null; created_at: string }[] = [];
  let isBroker = false;
  type BrokerBuyerSummary = { display_name: string | null; verification_status: string; acquisition_timeline: string | null; funding_status: string | null; proof_of_funds_status: string | null; buyer_summary: string | null; experience_level: string | null; available_cash: number | null; credit_readiness: string | null; financial_visibility: string; nda_complete: boolean; labels: { profile: string; verification: string; financial: string } };
  let buyerProfiles = new Map<string, BrokerBuyerSummary>();
  if (isSupabaseConfigured() && user.source === "supabase") {
    const supabase = await createSupabaseServerClient();
    userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      const [{ data: profile }, { data: notificationData }] = await Promise.all([
        supabase.from("profiles").select("account_roles").eq("user_id", userId).maybeSingle(),
        supabase.from("marketplace_notifications").select("id,title,body,inquiry_id,read_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      ]);
      isBroker = ((profile?.account_roles as string[] | null) ?? []).includes("broker");
      notifications = notificationData ?? [];
    }
  }
  const inquiries = await getMyInquiries(userId);
  if (isBroker && userId && inquiries.length) {
    const supabase = await createSupabaseServerClient();
    const brokerInquiries = inquiries.filter((inquiry) => inquiry.broker_id === userId && !inquiry.id.startsWith("demo-"));
    const summaries = await Promise.all(brokerInquiries.map(async (inquiry) => ({ inquiry, result: await supabase.rpc("get_broker_buyer_summary", { target_inquiry: inquiry.id }) })));
    buyerProfiles = new Map(summaries.filter(({ result }) => result.data).map(({ inquiry, result }) => [inquiry.buyer_id, result.data as BrokerBuyerSummary]));
  }
  const featured = inquiries[0];
  const brokerQueue = isBroker && userId ? inquiries.filter((inquiry) => inquiry.broker_id === userId && (
    ["submitted", "nda_signed", "offer"].includes(inquiry.status) || inquiry.financial_access_status === "requested"
  )) : [];
  return (
    <PlatformShell locale={locale} active="inbox">
      <div className="dashboard-content">
        <PageHeading eyebrow="Messages and notifications" title="Deal inbox" body="Keep buyer requests, broker responses, NDA notices, and document updates connected to the right opportunity." />
        {query.sent && <p className="notice">Your information request was sent to the broker.</p>}
        {query.draft && <p className="notice">This example request is ready. A live broker listing will send it directly into the broker’s inbox.</p>}
        {isBroker && <section className="broker-action-queue">
          <div className="section-inline-heading"><div><span className="source-label">Broker workspace</span><h2>Action queue</h2></div><span>{brokerQueue.length} need attention</span></div>
          {brokerQueue.length ? <div className="broker-queue-grid">{brokerQueue.map((inquiry) => {
            const buyer = buyerProfiles.get(inquiry.buyer_id);
            const action = inquiry.financial_access_status === "requested" ? "Review financial request" : inquiry.status === "submitted" ? "Review new buyer" : inquiry.status === "nda_signed" ? "NDA signed — decide next step" : "Review offer or LOI";
            return <Link href={`/${locale}/dashboard/deals/${inquiry.id}`} key={inquiry.id}>
              <div><span>{action}</span><strong>{inquiry.marketplace_listings?.title ?? inquiry.subject}</strong></div>
              <p>{buyer?.display_name ?? "Prospective buyer"} · {buyer?.acquisition_timeline ?? inquiry.financial_request_timeline ?? "Timeline private or not provided"}</p>
              <div className="buyer-readiness-tags"><small>{buyer?.funding_status ?? "Funding details private"}</small><small className={buyer?.proof_of_funds_status === "verified" ? "is-verified" : ""}>Funds: {buyer?.proof_of_funds_status?.replaceAll("_", " ") ?? "private"}</small>{buyer?.experience_level && <small>Experience: {buyer.experience_level.replaceAll("_", " ")}</small>}</div>
              {buyer?.available_cash && <p className="buyer-financial-disclosure">Buyer-provided available cash: ${Number(buyer.available_cash).toLocaleString("en-US")} · not lender verified</p>}
              {buyer?.buyer_summary && <blockquote>{buyer.buyer_summary}</blockquote>}
              <small className="buyer-source-label">{buyer?.labels?.profile ?? "Buyer provided"} · {buyer?.verification_status ?? "unverified"} account</small>
              <b>Open workspace →</b>
            </Link>;
          })}</div> : <p className="panel-empty broker-queue-empty">Nothing needs your attention right now. Automated NDA requests and routine updates stay out of your queue.</p>}
        </section>}
        <section className="notification-center" id="notifications">
          <div className="section-inline-heading"><div><span className="source-label">Updates</span><h2>Notifications</h2></div><span>{notifications.filter((item) => !item.read_at).length} unread</span></div>
          <div className="notification-list">
            {notifications.map((notification) => <article className={notification.read_at ? "" : "is-unread"} key={notification.id}>
              <span aria-hidden="true">{notification.read_at ? "○" : "●"}</span>
              <div><strong>{notification.title}</strong><p>{notification.body}</p><small>{new Date(notification.created_at).toLocaleString(locale)}</small></div>
              {notification.inquiry_id && <Link href={`/${locale}/dashboard/deals/${notification.inquiry_id}`}>Open</Link>}
              {!notification.read_at && <form action={markNotificationRead}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="notification_id" value={notification.id} /><button type="submit">Mark read</button></form>}
            </article>)}
            {!notifications.length && <p className="panel-empty">Deal updates will appear here. Important changes are also shown inside each secure workspace.</p>}
          </div>
        </section>
        <div className="inbox-layout">
          <aside className="conversation-list">
            <header><strong>Conversations</strong><span>{inquiries.length} active</span></header>
            {inquiries.map((inquiry) => (
              <Link href={`/${locale}/dashboard/deals/${inquiry.id}`} key={inquiry.id}>
                <span className="conversation-avatar">CV</span>
                <div><strong>{inquiry.marketplace_listings?.title ?? inquiry.subject}</strong><span>{inquiry.marketplace_listings ? `${inquiry.marketplace_listings.city}, ${inquiry.marketplace_listings.state_code}` : "Deal workspace"}</span><small>{inquiry.initial_message.slice(0, 95)}</small></div>
                <span className="stage">{inquiry.status.replaceAll("_", " ")}</span>
              </Link>
            ))}
          </aside>
          <section className="conversation-preview panel">
            {featured ? <>
              <div className="panel__header"><div><span className="source-label">Most recent conversation</span><h2>{featured.marketplace_listings?.title ?? featured.subject}</h2></div><span className="stage">{featured.status.replaceAll("_", " ")}</span></div>
              <p className="inbox-preview-message">{featured.initial_message}</p>
              <div className="inbox-next-step">
                <span>Next step</span>
                <strong>{featured.status === "nda_sent" ? "Review and sign the confidentiality agreement" : "Continue the conversation in the secure workspace"}</strong>
                <p>Messages, signatures, documents, and status changes stay together in one protected record.</p>
              </div>
              <Link className="button button--primary inbox-open-workspace" href={`/${locale}/dashboard/deals/${featured.id}`}>Open secure workspace →</Link>
            </> : <div className="empty-state"><strong>Your deal inbox is ready</strong><p>Request information from a marketplace listing to start a secure conversation.</p><Link className="button button--primary" href={`/${locale}/dashboard/marketplace`}>Browse marketplace</Link></div>}
            {featured && !featured.id.startsWith("demo-") && <>
              <form className="quick-reply" action={sendMessage}>
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={featured.id} />
                <textarea name="body" placeholder="Write a secure message…" required />
                <button className="button button--primary" type="submit">Send message</button>
              </form>
              <form className="status-control" action={advanceInquiry}>
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={featured.id} />
                <select name="status"><option value="screening">Begin screening</option><option value="approved">Approve buyer</option><option value="declined">Decline request</option></select>
                <button className="button button--light" type="submit">Update status</button>
              </form>
            </>}
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
