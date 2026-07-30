import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getCrestviewUser } from "@/lib/current-user";
import { getMyInquiries } from "@/lib/marketplace";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { advanceInquiry, sendMessage } from "../marketplace/actions";

export const metadata: Metadata = { title: "Deal inbox" };

export default async function InboxPage({ params, searchParams }: PageProps<"/[locale]/dashboard/inbox">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const user = await getCrestviewUser(locale);
  let userId: string | undefined;
  if (isSupabaseConfigured() && user.source === "supabase") {
    userId = (await (await createSupabaseServerClient()).auth.getUser()).data.user?.id;
  }
  const inquiries = await getMyInquiries(userId);
  const featured = inquiries[0];
  return (
    <PlatformShell locale={locale} active="inbox">
      <div className="dashboard-content">
        <PageHeading eyebrow="Messages and notifications" title="Deal inbox" body="Keep buyer requests, broker responses, NDA notices, and document updates connected to the right opportunity." />
        {query.sent && <p className="notice">Your information request was sent to the broker.</p>}
        {query.draft && <p className="notice">This example request is ready. A live broker listing will send it directly into the broker’s inbox.</p>}
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
