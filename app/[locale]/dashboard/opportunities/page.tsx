import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { OpportunitySearch } from "@/components/opportunity-search";
import { opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OpportunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
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
        <PageHeading eyebrow="DealFlow" title="Businesses for sale" body="Search across sourced public listings. Confidential businesses keep their broker-provided titles." />
        <div className="data-notice"><strong>Seller-reported information</strong><span>Listings may change or be withdrawn. Values shown as N/A or “Inquire with seller” were not publicly disclosed and are never treated as zero.</span></div>
        <OpportunitySearch items={opportunities} locale={locale} storageReady={storageReady} preferences={preferences} />
      </div>
    </PlatformShell>
  );
}
