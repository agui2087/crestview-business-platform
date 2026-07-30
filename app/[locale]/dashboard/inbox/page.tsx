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
            <div className="panel__header"><h2>What happens here</h2></div>
            <div className="inbox-feature-list">
              <article><span>1</span><div><strong>Buyer sends a structured request</strong><p>The broker sees acquisition experience, funding readiness, requested items, and the buyer’s complete message.</p></div></article>
              <article><span>2</span><div><strong>Broker screens and responds</strong><p>Each response remains attached to the opportunity rather than becoming another disconnected email thread.</p></div></article>
              <article><span>3</span><div><strong>Notifications move the deal forward</strong><p>Both sides receive notices for messages, signatures, uploaded documents, meetings, and status changes.</p></div></article>
            </div>
            {inquiries[0] && !inquiries[0].id.startsWith("demo-") && <>
              <form className="quick-reply" action={sendMessage}>
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={inquiries[0].id} />
                <textarea name="body" placeholder="Write a secure message…" required />
                <button className="button button--primary" type="submit">Send message</button>
              </form>
              <form className="status-control" action={advanceInquiry}>
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="inquiry_id" value={inquiries[0].id} />
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
