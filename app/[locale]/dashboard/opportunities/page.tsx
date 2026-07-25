import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { OpportunitySearch } from "@/components/opportunity-search";
import { opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

export default async function OpportunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const storageReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return (
    <PlatformShell locale={locale} active="opportunities">
      <div className="dashboard-content">
        <PageHeading eyebrow="DealFlow" title="Businesses for sale" body="Search across sourced public listings. Confidential businesses keep their broker-provided titles." />
        <div className="data-notice"><strong>Seller-reported information</strong><span>Listings may change or be withdrawn. Values shown as N/A or “Inquire with seller” were not publicly disclosed and are never treated as zero.</span></div>
        <OpportunitySearch items={opportunities} locale={locale} storageReady={storageReady} />
      </div>
    </PlatformShell>
  );
}
