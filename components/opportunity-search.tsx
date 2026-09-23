"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {matchesLocation, parseAmount} from "@/lib/marketplace-search";
import type { Opportunity } from "@/lib/demo-data";

const PAGE_SIZE = 30;
const LOCATION_SUGGESTIONS = [
  "Austin, TX",
  "Boston, MA",
  "Chicago, IL",
  "Dallas, TX",
  "Denver, CO",
  "Los Angeles, CA",
  "Miami, FL",
  "New York, NY",
  "Phoenix, AZ",
  "Portland, OR",
  "San Diego, CA",
  "San Francisco, CA",
  "Seattle, WA",
] as const;

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function score(item: Opportunity, query: string) {
  const phrase = normalize(query);
  if (!phrase) return 1;
  const title = normalize(item.title);
  const haystack = normalize([item.title, item.industry, item.location, item.description, ...item.highlights].join(" "));
  const tokens = phrase.split(/\s+/).filter(Boolean);
  let total = title.includes(phrase) ? 120 : haystack.includes(phrase) ? 80 : 0;
  for (const token of tokens) {
    if (title.includes(token)) total += 30;
    else if (haystack.includes(token)) total += 12;
    else {
      const words = haystack.split(" ");
      if (words.some((word) => word.startsWith(token) || token.startsWith(word))) total += 5;
    }
  }
  return total;
}

type BuyerPreferences = {
  industries: string[];
  locations: string[];
  maximum_price: number | null;
  minimum_cash_flow: number | null;
  seller_financing_preferred: boolean;
} | null;

function buyerMatch(item: Opportunity, preferences: BuyerPreferences) {
  if (!preferences) return null;
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  if (preferences.industries.length) {
    possible += 30;
    if (preferences.industries.some((value) => normalize(item.industry).includes(normalize(value)) || normalize(item.title).includes(normalize(value)))) {
      earned += 30;
      reasons.push("preferred industry");
    }
  }
  if (preferences.locations.length) {
    possible += 25;
    if (preferences.locations.some((value) => { const [city = '', state = ''] = item.location.split(','); return matchesLocation(city, state, value); })) {
      earned += 25;
      reasons.push("preferred location");
    }
  }
  if (preferences.maximum_price) {
    possible += 20;
    if (item.priceValue !== null && item.priceValue <= preferences.maximum_price) {
      earned += 20;
      reasons.push("within budget");
    }
  }
  if (preferences.minimum_cash_flow) {
    possible += 20;
    if (item.cashFlowValue !== null && item.cashFlowValue >= preferences.minimum_cash_flow) {
      earned += 20;
      reasons.push("cash flow target");
    }
  }
  if (preferences.seller_financing_preferred) {
    possible += 5;
    if (item.highlights.some((value) => normalize(value).includes("seller financ"))) {
      earned += 5;
      reasons.push("seller financing");
    }
  }
  if (!possible) return null;
  return { score: Math.round((earned / possible) * 100), reasons };
}

export function OpportunitySearch({
  items,
  locale,
  storageReady,
  preferences,
}: {
  items: Opportunity[];
  locale: string;
  storageReady: boolean;
  preferences: BuyerPreferences;
}) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("All industries");
  const [source, setSource] = useState("All sources");
  const [sortBy, setSortBy] = useState("relevance");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const es = locale === "es";
  const industries = useMemo(
    () => ["All industries", ...Array.from(new Set(items.map((item) => item.industry))).sort()],
    [items],
  );
  const sources = useMemo(
    () => ["All sources", ...Array.from(new Set(items.map((item) => item.source))).sort()],
    [items],
  );
  const locationSuggestions = Array.from(new Set([...items.map(item => item.location), ...LOCATION_SUGGESTIONS])).sort();
  const invalidPrice = parseAmount(maxPrice) === undefined;
  const searchResult = useMemo(
    () => {
      const ceiling = parseAmount(maxPrice);
      const eligible = items
        .map((item) => ({ item, rank: score(item, query), match: buyerMatch(item, preferences) }))
        .filter(({ item, rank }) =>
          rank > 0
          && (industry === "All industries" || item.industry === industry)
          && (source === "All sources" || item.source === source)
          && ceiling !== undefined && (ceiling === null || (item.priceValue !== null && item.priceValue <= ceiling)),
        );
      const exact = eligible.filter(({item}) => { const [city = "", state = ""] = item.location.split(","); return matchesLocation(city, state, location); });
      const filtered = exact;

      const sorted = filtered.sort((a, b) => {
        if (sortBy === "price-low") return (a.item.priceValue ?? Number.MAX_SAFE_INTEGER) - (b.item.priceValue ?? Number.MAX_SAFE_INTEGER);
        if (sortBy === "price-high") return (b.item.priceValue ?? -1) - (a.item.priceValue ?? -1);
        if (sortBy === "cash-flow") return (b.item.cashFlowValue ?? -1) - (a.item.cashFlowValue ?? -1);
        if (sortBy === "revenue") return (b.item.revenueValue ?? -1) - (a.item.revenueValue ?? -1);
        if (a.match?.score !== b.match?.score) return (b.match?.score ?? -1) - (a.match?.score ?? -1);
        return b.rank - a.rank;
      });
      return { results: sorted, exactCount: exact.length };
    },
    [items, query, industry, source, sortBy, maxPrice, location, preferences],
  );
  const { results, exactCount } = searchResult;
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleResults = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updateFilters(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <>
      <div className="smart-search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => updateFilters(() => setQuery(event.target.value))} placeholder={es ? "Describe el negocio o escribe cualquier palabra que recuerdes" : "Describe the business or enter any words you remember"} aria-label={es ? "Buscar oportunidades" : "Search opportunities"} />
        {query && <button onClick={() => updateFilters(() => setQuery(""))} type="button">{es ? "Borrar" : "Clear"}</button>}
      </div>
      <p className="search-help">{es ? "Busca títulos, descripciones, industrias, ubicaciones y palabras parciales. Las coincidencias más cercanas aparecen primero." : "Searches titles, descriptions, industries, locations, and partial word matches. The closest matches appear first."}</p>
      <div className="location-search">
        <label className="location-combobox">
          {es ? "Buscar ubicación" : "Search location"}
          <input
            value={location}
            onChange={(event) => updateFilters(() => setLocation(event.target.value))}
            placeholder={es ? "Ciudad, Estado (ejemplo: Portland, OR)" : "City, State (example: Portland, OR)"}
            aria-label={es ? "Buscar ubicación" : "Search location"}
            list="crestview-location-suggestions"
            autoComplete="off"
          />
          <datalist id="crestview-location-suggestions">{locationSuggestions.map(value=><option key={value} value={value}/>)}</datalist>
        </label>
        <div>
          <strong>{es ? "Búsqueda por ubicación" : "Location-first search"}</strong>
          <span>{es ? "Busca una ciudad exacta o un estado completo/abreviado. Confirma la disponibilidad con la fuente." : "Search an exact city or a full/abbreviated state. Confirm availability with the listing source."}</span>
        </div>
      </div>
      <div className="opportunity-filters" aria-label={es ? "Filtros de oportunidades" : "Opportunity filters"}>
        <label>{es ? "Industria" : "Industry"}<select value={industry} onChange={(event) => updateFilters(() => setIndustry(event.target.value))}>{industries.map((item) => <option key={item} value={item}>{item === "All industries" && es ? "Todas las industrias" : item}</option>)}</select></label>
        <label>{es ? "Fuente" : "Source"}<select value={source} onChange={(event) => updateFilters(() => setSource(event.target.value))}>{sources.map((item) => <option key={item} value={item}>{item === "All sources" && es ? "Todas las fuentes" : item}</option>)}</select></label>
        <label>{es ? "Precio máximo" : "Maximum price"}<input value={maxPrice} onChange={(event) => updateFilters(() => setMaxPrice(event.target.value))} inputMode="decimal" aria-invalid={invalidPrice} aria-describedby={invalidPrice ? "search-price-error" : undefined} placeholder={es ? "Sin máximo" : "No maximum"} /></label>
        <label>{es ? "Ordenar por" : "Sort by"}<select value={sortBy} onChange={(event) => updateFilters(() => setSortBy(event.target.value))}>
          <option value="relevance">{es ? "Mejor coincidencia" : "Closest match"}</option>
          <option value="price-low">{es ? "Precio: menor a mayor" : "Price: low to high"}</option>
          <option value="price-high">{es ? "Precio: mayor a menor" : "Price: high to low"}</option>
          <option value="cash-flow">{es ? "Mayor flujo de caja" : "Highest cash flow"}</option>
          <option value="revenue">{es ? "Mayores ingresos" : "Highest revenue"}</option>
        </select></label>
        <button type="button" onClick={() => { setQuery(""); setIndustry("All industries"); setSource("All sources"); setMaxPrice(""); setSortBy("relevance"); setLocation(""); setPage(1); }}>{es ? "Borrar todos los filtros" : "Reset filters"}</button>
      </div>
      {invalidPrice && <p id="search-price-error" role="alert">{es ? "Introduce un precio válido de cero o más, por ejemplo 500,000." : "Enter a valid price of zero or more, for example 500,000."}</p>}
      {location.trim() && <div className="location-expansion" role="status">{exactCount} {es ? "resultados para" : "results for"} {location}</div>}
      <div className="comparison-toolbar" aria-live="polite">
        <span>{selected.length} {es ? "seleccionados (máximo 4)" : "selected (maximum 4)"}</span>
        <Link className={`button button--light ${selected.length < 2 ? "is-disabled" : ""}`} aria-disabled={selected.length < 2} href={selected.length >= 2 ? `/${locale}/dashboard/opportunities/compare?ids=${selected.join(",")}` : `/${locale}/dashboard/opportunities`}>
          {es ? "Comparar seleccionados" : "Compare selected"}
        </Link>
        {selected.length > 0 && <button type="button" onClick={() => setSelected([])}>{es ? "Borrar selección" : "Clear selection"}</button>}
      </div>
      <div className="result-count" role="status"><strong>{results.length}</strong> {es ? "resultados de las fuentes" : "source listings"} · {visibleResults.length} {es ? "en esta página" : "on this page"} · {safePage}/{pageCount}</div>
      <div className="opportunity-list">
        {visibleResults.map(({ item, match }) => (
          <article className="opportunity-row" key={item.id}>
            <label className="compare-check">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={!selected.includes(item.id) && selected.length >= 4}
                onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
              />
              <span className="sr-only">{es ? `Comparar ${item.title}` : `Compare ${item.title}`}</span>
            </label>
            <div className="opportunity-row__main">
              <span className="source-label">{item.source} · {es ? "revisado" : "checked"} {item.lastChecked}</span>
              <h2><Link href={`/${locale}/dashboard/opportunities/${item.id}`}>{item.title}</Link></h2>
              <p>{item.industry} · {item.location}</p>
              {match && <span className="match-explanation"><strong>{match.score}% {es ? "coincidencia" : "match"}</strong>{match.reasons.length ? ` · ${match.reasons.map(reason => es ? ({'preferred industry':'industria preferida','preferred location':'ubicación preferida','within budget':'dentro del presupuesto','cash flow target':'objetivo de flujo de caja','seller financing':'financiación del vendedor'}[reason] ?? reason) : reason).join(", ")}` : (es ? " · revisar criterios" : " · criteria need review")}</span>}
            </div>
            <div><span>{es ? "Precio" : "Asking price"}</span><strong>{item.price}</strong></div>
            <div><span>{es ? "Ingresos" : "Revenue"}</span><strong>{item.revenue}</strong></div>
            <div><span>{es ? "Flujo de caja / SDE" : "Cash flow / SDE"}</span><strong>{item.cashFlow}</strong></div>
            <div className="listing-status"><strong>{item.status}</strong><span>{item.publicBusinessName ? (es ? "Nombre público" : "Name public") : (es ? "Confidencial" : "Confidential")}</span></div>
            <Link className="save-button" href={`/${locale}/dashboard/opportunities/${item.id}`}>{es ? "Ver" : "View"}</Link>
          </article>
        ))}
        {results.length === 0 && <div className="empty-state"><h2>{es ? "No hay coincidencias" : "No close matches yet"}</h2><p>{es ? "Prueba otros filtros o borra todos los filtros." : "Try different filters or reset all filters."}</p></div>}
      </div>
      {pageCount > 1 && (
        <nav className="opportunity-pagination" aria-label={es ? "Páginas de resultados" : "Opportunity result pages"}>
          <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{es ? "Anterior" : "Previous"}</button>
          <span>{es ? "Página" : "Page"} {safePage} / {pageCount}</span>
          <button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>{es ? "Siguiente" : "Next"}</button>
        </nav>
      )}
      {!storageReady && <p className="search-help">{es ? "Guardar búsquedas y oportunidades requiere conexión de almacenamiento." : "Saving searches and opportunities requires a storage connection."}</p>}
    </>
  );
}
