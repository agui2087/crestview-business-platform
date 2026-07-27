import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { saveBuyerPreferences } from "./actions";

type Preferences = {
  industries: string[];
  locations: string[];
  maximum_price: number | null;
  minimum_cash_flow: number | null;
  owner_involvement: string;
  seller_financing_preferred: boolean;
  experience_level: string;
};

const defaults: Preferences = {
  industries: [],
  locations: [],
  maximum_price: null,
  minimum_cash_flow: null,
  owner_involvement: "flexible",
  seller_financing_preferred: false,
  experience_level: "first_time",
};

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = await searchParams;
  let preferences = defaults;

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("buyer_preferences")
        .select("industries, locations, maximum_price, minimum_cash_flow, owner_involvement, seller_financing_preferred, experience_level")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) preferences = data as Preferences;
    }
  }

  return (
    <PlatformShell locale={locale} active="settings">
      <div className="dashboard-content">
        <PageHeading eyebrow="Preferences" title="Settings" body="Teach Crestview what a strong acquisition looks like for you." />
        <form className="settings-panel" id="listing-alerts" action={saveBuyerPreferences}>
          <input type="hidden" name="locale" value={locale} />
          <div>
            <span>Buyer profile</span>
            <h2>Acquisition criteria and listing alerts</h2>
            <p>These preferences power personalized matches and will later control new-listing notifications.</p>
          </div>
          {messages.saved && <p className="auth-success">Your buyer preferences were saved.</p>}
          {messages.error && <p className="auth-error">Crestview could not save these preferences. Please try again.</p>}
          <div className="preference-grid">
            <label>Industries
              <input name="industries" defaultValue={preferences.industries.join(", ")} placeholder="HVAC, plumbing, business services" />
              <small>Separate multiple industries with commas.</small>
            </label>
            <label>Preferred locations
              <input name="locations" defaultValue={preferences.locations.join(", ")} placeholder="Portland OR, Seattle WA" />
              <small>Enter cities, states, or regions.</small>
            </label>
            <label>Maximum asking price
              <input name="maximum_price" defaultValue={preferences.maximum_price ?? ""} inputMode="numeric" placeholder="2500000" />
            </label>
            <label>Minimum cash flow
              <input name="minimum_cash_flow" defaultValue={preferences.minimum_cash_flow ?? ""} inputMode="numeric" placeholder="300000" />
            </label>
            <label>Preferred owner involvement
              <select name="owner_involvement" defaultValue={preferences.owner_involvement}>
                <option value="flexible">Flexible</option>
                <option value="owner_operator">Owner operated</option>
                <option value="semi_absentee">Semi-absentee</option>
                <option value="absentee">Absentee</option>
              </select>
            </label>
            <label>Acquisition experience
              <select name="experience_level" defaultValue={preferences.experience_level}>
                <option value="first_time">First acquisition</option>
                <option value="experienced">Previously acquired a business</option>
                <option value="professional">Professional buyer or sponsor</option>
              </select>
            </label>
          </div>
          <label className="preference-check">
            <input type="checkbox" name="seller_financing_preferred" defaultChecked={preferences.seller_financing_preferred} />
            Prefer opportunities offering seller financing
          </label>
          <button className="button button--primary" type="submit">Save buyer profile</button>
        </form>
      </div>
    </PlatformShell>
  );
}
