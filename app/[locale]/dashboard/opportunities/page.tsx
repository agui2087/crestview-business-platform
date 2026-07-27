import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { OpportunitySearch } from "@/components/opportunity-search";
import { opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { platformCopy } from "@/lib/platform-copy";

export default async function OpportunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = platformCopy(locale);
  const storageReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  let preferences = null;
  if (storageReady) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("buyer_preferences")
        .select("industries, locations, maximum_price, minimum_cash_flow, seller_financing_preferred")
        .eq("user_id", user.id)
        .maybeSingle();
      preferences = data;
    }
  }

  return (
    <PlatformShell locale={locale} active="opportunities">
      <div className="dashboard-content">
        <PageHeading eyebrow={text.opportunities.eyebrow} title={text.opportunities.title} body={text.opportunities.body} />
        <div className="data-notice"><strong>{text.opportunities.seller}</strong><span>{text.opportunities.notice}</span></div>
        <OpportunitySearch items={opportunities} locale={locale} storageReady={storageReady} preferences={preferences} />
      </div>
    </PlatformShell>
  );
}
