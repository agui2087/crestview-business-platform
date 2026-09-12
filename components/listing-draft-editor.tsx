import type {MarketplaceListing} from "@/lib/marketplace";
import {FormattedMoneyInput} from "@/components/formatted-money-input";
import {NdaFileInput} from "@/components/nda-file-input";
import {attachDraftNda,updateDraftListing} from "@/app/[locale]/dashboard/marketplace/actions";

export function ListingDraftEditor({listing,locale}:{listing:MarketplaceListing;locale:string}) {
  const es=locale === "es";
  return <div className="listing-draft-continuation">
    <details className="listing-editor"><summary><strong>{es ? "Continuar editando el borrador" : "Continue editing draft"}</strong></summary>
      <form action={updateDraftListing}>
        <input type="hidden" name="locale" value={locale}/><input type="hidden" name="listing_id" value={listing.id}/>
        <div className="listing-form-grid">
          <label>{es ? "Título" : "Listing title"}<input name="title" defaultValue={listing.title} minLength={5} maxLength={140} required/></label>
          <label>{es ? "Industria" : "Industry"}<input name="industry" defaultValue={listing.industry} minLength={2} maxLength={80} required/></label>
          <label>{es ? "Ciudad" : "City"}<input name="city" defaultValue={listing.city} minLength={2} maxLength={80} required/></label>
          <label>{es ? "Estado" : "State"}<input name="state_code" defaultValue={listing.state_code} minLength={2} maxLength={2} required/></label>
          <label>{es ? "Precio solicitado" : "Asking price"}<FormattedMoneyInput name="asking_price" defaultValue={listing.asking_price ?? ""}/></label>
          <label>{es ? "Ingresos anuales" : "Annual revenue"}<FormattedMoneyInput name="annual_revenue" defaultValue={listing.annual_revenue ?? ""}/></label>
          <label>{es ? "Flujo de caja" : "Cash flow / SDE"}<FormattedMoneyInput name="cash_flow" defaultValue={listing.cash_flow ?? ""}/></label>
          <label className="span-two">{es ? "Resumen público" : "Public summary"}<textarea name="summary" defaultValue={listing.summary} minLength={20} maxLength={1200} required/></label>
        </div><button className="button button--primary" type="submit">{es ? "Guardar cambios del borrador" : "Save draft changes"}</button>
      </form>
    </details>
    {!listing.nda_automatic && <details className="listing-editor"><summary><strong>{es ? "Agregar el NDA al borrador" : "Add NDA to this draft"}</strong></summary><form action={attachDraftNda}>
      <input type="hidden" name="locale" value={locale}/><input type="hidden" name="listing_id" value={listing.id}/>
      <NdaFileInput locale={locale} required/>
      <label><input type="checkbox" name="nda_attested" required/>{es ? "Estoy autorizado para usar este acuerdo revisado para el anuncio." : "I am authorized to use this reviewed agreement for the listing."}</label>
      <p>{es ? "Guardar el NDA no publica el anuncio. Después elige Publicado en Estado. Se requiere un plan de corredor activo." : "Saving the NDA does not publish the listing. Next choose Published under Status. An active broker plan is required."}</p>
      <button className="button button--primary" type="submit">{es ? "Guardar NDA revisado" : "Save reviewed NDA"}</button>
    </form></details>}
  </div>;
}
