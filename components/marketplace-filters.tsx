import Link from 'next/link';
import {searchValues,type SearchQuery} from '@/lib/marketplace-search';

export function MarketplaceFilters({query,cities,industries,locale,path,errors}: {query:SearchQuery;cities:string[];industries:string[];locale:string;path:string;errors:string[]}) {
  const es=locale==='es', v=searchValues(query);
  const advanced=Boolean(v.minPrice||v.maxPrice||v.minRevenue||v.minCashFlow||v.financing);
  return <form className="marketplace-filter buyer-filters" method="get" action={path} key={JSON.stringify(v)} aria-label={es?'Filtros de negocios':'Business filters'}>
    <label>{es?'Palabras clave':'Keywords'}<input name="q" defaultValue={v.q} placeholder={es?'Nombre, servicio o descripción':'Name, service, or description'}/></label>
    <label>{es?'Ubicación':'Location'}<input name="city" list="marketplace-locations" defaultValue={v.city} placeholder={es?'Ciudad o estado':'City or state'} aria-describedby="location-help"/></label>
    <datalist id="marketplace-locations">{cities.map(city=><option key={city} value={city}/>)}</datalist>
    <label>{es?'Industria':'Industry'}<select name="industry" defaultValue={v.industry}><option value="">{es?'Todas las industrias':'All industries'}</option>{[...new Set([...industries,...(v.industry?[v.industry]:[])])].sort().map(x=><option key={x}>{x}</option>)}</select></label>
    <label>{es?'Ordenar por':'Sort by'}<select name="sort" defaultValue={v.sort}><option value="">{es?'Orden del mercado':'Marketplace order'}</option><option value="newest">{es?'Actualizados recientemente':'Recently updated'}</option><option value="price-low">{es?'Precio: menor a mayor':'Price: low to high'}</option><option value="price-high">{es?'Precio: mayor a menor':'Price: high to low'}</option><option value="revenue">{es?'Mayores ingresos':'Highest revenue'}</option><option value="cash-flow">{es?'Mayor flujo de caja':'Highest cash flow'}</option></select></label>
    <p id="location-help" className="buyer-filter-help">{es?'Ciudad exacta o estado completo/abreviado, por ejemplo Portland, OR u Oregon.':'Exact city or full/abbreviated state, for example Portland, OR or Oregon.'}</p>
    <details open={advanced||errors.length>0}><summary>{es?'Precio y criterios financieros':'Price and financial criteria'}</summary><div className="buyer-filter-numbers">
      {([['minPrice','Minimum price','Precio mínimo'],['maxPrice','Maximum price','Precio máximo'],['minRevenue','Minimum annual revenue','Ingresos anuales mínimos'],['minCashFlow','Minimum cash flow','Flujo de caja mínimo']] as const).map(([name,en,spanish])=><label key={name}>{es?spanish:en} (USD)<input name={name} inputMode="decimal" defaultValue={v[name]} placeholder={es?'Sin límite':'No limit'} aria-invalid={errors.includes(name)||((name==='minPrice'||name==='maxPrice')&&errors.includes('range'))} aria-describedby={errors.length?'filter-errors':undefined}/></label>)}
      <label>{es?'Financiación del vendedor':'Seller financing'}<select name="financing" defaultValue={v.financing}><option value="">{es?'Sin preferencia':'No preference'}</option><option value="yes">{es?'Disponible según el vendedor':'Reported available'}</option></select></label>
    </div><p className="buyer-filter-help">{es?'Los filtros financieros excluyen cifras no publicadas. La financiación está sujeta a los términos del vendedor.':'Financial filters exclude undisclosed figures. Financing is subject to seller terms.'}</p></details>
    {errors.length>0&&<p className="notice" id="filter-errors" role="alert">{es?'Introduce importes válidos de cero o más (ejemplo: 500,000). El precio mínimo no puede superar el máximo. Corrige los campos antes de ver resultados.':'Enter valid amounts of zero or more (example: 500,000). Minimum price cannot exceed maximum price. Correct the fields to see results.'}</p>}
    <div className="buyer-filter-actions"><button className="button button--primary" type="submit">{es?'Mostrar resultados':'Show matches'}</button><Link className="filter-reset" href={path}>{es?'Borrar todos los filtros':'Clear all filters'}</Link></div>
  </form>;
}
