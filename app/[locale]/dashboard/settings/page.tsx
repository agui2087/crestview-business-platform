import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <PlatformShell locale={locale} active="settings"><div className="dashboard-content">
    <PageHeading eyebrow="Preferences" title="Settings" body="Manage your acquisition criteria, notifications, language, and organization." />
    <section className="settings-panel" id="listing-alerts"><div><span>Opportunity notifications</span><h2>Preferred business alerts</h2><p>Get notified when a new listing matches your target profile.</p></div><div className="preference-grid"><label>Industries<input defaultValue="HVAC, plumbing, fire protection" /></label><label>Locations<input defaultValue="California, Arizona, Oregon" /></label><label>Maximum asking price<input defaultValue="$2,500,000" /></label><label>Minimum cash flow<input defaultValue="$300,000" /></label></div><button className="button button--primary" disabled>Connect account to save alerts</button></section>
  </div></PlatformShell>;
}
