import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { OpportunitySearch } from "@/components/opportunity-search";
import { BuyerFitCalculator } from "@/components/buyer-fit-calculator";
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
  let financialProfile: { available_cash: number | null; buyer_injection_percent: number; illustrative_interest_rate: number } | null = null;
  if (storageReady) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [{ data }, { data: financeData }] = await Promise.all([
        supabase.from("buyer_preferences").select("industries, locations, maximum_price, minimum_cash_flow, desired_owner_income, seller_financing_preferred").eq("user_id", user.id).maybeSingle(),
        supabase.from("buyer_financial_profiles").select("available_cash,buyer_injection_percent,illustrative_interest_rate").eq("user_id", user.id).maybeSingle(),
      ]);
      preferences = data;
      financialProfile = financeData;
    }
  }

  return (
    <PlatformShell locale={locale} active="opportunities">
      <div className="dashboard-content">
        <PageHeading eyebrow={text.opportunities.eyebrow} title={text.opportunities.title} body={text.opportunities.body} action={<Link className="button button--light" href="/api/export/opportunities">{locale === "es" ? "Exportar CSV" : "Export CSV"}</Link>} />
        <div className="data-notice"><strong>{text.opportunities.seller}</strong><span>{text.opportunities.notice}</span></div>
        <BuyerFitCalculator locale={locale} savedAvailableCash={financialProfile?.available_cash} savedDesiredIncome={preferences?.desired_owner_income} savedInjectionPercent={financialProfile?.buyer_injection_percent} savedInterestRate={financialProfile?.illustrative_interest_rate} />
        <OpportunitySearch items={opportunities} locale={locale} storageReady={storageReady} preferences={preferences} />
      </div>
    </PlatformShell>
  );
}
