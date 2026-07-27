import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { saveAccountProfile, saveBuyerPreferences } from "./actions";

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
  const es = locale === "es";
  const messages = await searchParams;
  let preferences = defaults;
  let profile = { display_name: "", job_title: "", phone: "", organization_name: "Crestview Holdings" };

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
      const { data: profileData } = await supabase.from("profiles").select("display_name,job_title,phone,organization_name").eq("user_id", user.id).maybeSingle();
      if (profileData) profile = {
        display_name: profileData.display_name ?? "",
        job_title: profileData.job_title ?? "",
        phone: profileData.phone ?? "",
        organization_name: profileData.organization_name ?? "Crestview Holdings",
      };
    }
  }

  return (
    <PlatformShell locale={locale} active="settings">
      <div className="dashboard-content">
        <PageHeading eyebrow={es ? "Preferencias" : "Preferences"} title={es ? "Configuración" : "Settings"} body={es ? "Enséñale a Crestview cómo es una adquisición sólida para ti." : "Teach Crestview what a strong acquisition looks like for you."} />
        <form className="settings-panel" action={saveAccountProfile}>
          <input type="hidden" name="locale" value={locale}/>
          <div><span>{es ? "Cuenta y organización" : "Account and organization"}</span><h2>{es ? "Perfil público dentro de Crestview" : "Your Crestview profile"}</h2><p>{es ? "Tu nombre se usa en mensajes y borradores en toda la plataforma." : "Your name is used in messages and drafts throughout the platform."}</p></div>
          <div className="preference-grid">
            <label>{es ? "Nombre" : "Display name"}<input name="display_name" defaultValue={profile.display_name}/></label>
            <label>{es ? "Organización" : "Organization"}<input name="organization_name" defaultValue={profile.organization_name}/></label>
            <label>{es ? "Puesto" : "Job title"}<input name="job_title" defaultValue={profile.job_title}/></label>
            <label>{es ? "Teléfono" : "Phone"}<input name="phone" defaultValue={profile.phone}/></label>
          </div>
          <button className="button button--primary">{es ? "Guardar perfil" : "Save profile"}</button>
        </form>
        <form className="settings-panel" id="listing-alerts" action={saveBuyerPreferences}>
          <input type="hidden" name="locale" value={locale} />
          <div>
            <span>{es ? "Perfil del comprador" : "Buyer profile"}</span>
            <h2>{es ? "Criterios de adquisición y alertas" : "Acquisition criteria and listing alerts"}</h2>
            <p>{es ? "Estas preferencias mejoran las coincidencias personalizadas y controlarán futuras alertas." : "These preferences power personalized matches and will later control new-listing notifications."}</p>
          </div>
          {messages.saved && <p className="auth-success">{es ? "Tus preferencias fueron guardadas." : "Your buyer preferences were saved."}</p>}
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
          <button className="button button--primary" type="submit">{es ? "Guardar perfil" : "Save buyer profile"}</button>
        </form>
      </div>
    </PlatformShell>
  );
}
