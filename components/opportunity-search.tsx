"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Opportunity } from "@/lib/demo-data";

const PAGE_SIZE = 30;
const TARGET_RESULTS = 300;
const LOCATION_SUGGESTIONS = [
  "Atlanta, GA",
  "Austin, TX",
  "Baltimore, MD",
  "Boston, MA",
  "Charlotte, NC",
  "Chicago, IL",
  "Cincinnati, OH",
  "Cleveland, OH",
  "Columbus, OH",
  "Dallas, TX",
  "Denver, CO",
  "Detroit, MI",
  "Houston, TX",
  "Indianapolis, IN",
  "Jacksonville, FL",
  "Kansas City, MO",
  "Las Vegas, NV",
  "Los Angeles, CA",
  "Louisville, KY",
  "Memphis, TN",
  "Miami, FL",
  "Milwaukee, WI",
  "Minneapolis, MN",
  "Nashville, TN",
  "New Orleans, LA",
  "New York, NY",
  "Oklahoma City, OK",
  "Orlando, FL",
  "Philadelphia, PA",
  "Phoenix, AZ",
  "Pittsburgh, PA",
  "Portland, OR",
  "Raleigh, NC",
  "Richmond, VA",
  "Sacramento, CA",
  "Salt Lake City, UT",
  "San Antonio, TX",
  "San Diego, CA",
  "San Francisco, CA",
  "San Jose, CA",
  "Seattle, WA",
  "St. Louis, MO",
  "Tampa, FL",
  "Washington, DC",
] as const;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function locationParts(value: string) {
  const [city = "", region = ""] = value.split(",").map((part) => normalize(part));
  return { city, region };
}

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
    if (preferences.locations.some((value) => normalize(item.location).includes(normalize(value)))) {
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
  const searchResult = useMemo(
    () => {
      const ceiling = Number(maxPrice.replace(/[$,\s]/g, ""));
      const eligible = items
        .map((item) => ({ item, rank: score(item, query), match: buyerMatch(item, preferences) }))
        .filter(({ item, rank }) =>
          rank > 0
          && (industry === "All industries" || item.industry === industry)
          && (source === "All sources" || item.source === source)
          && (!ceiling || (item.priceValue !== null && item.priceValue <= ceiling)),
        );
      const requested = locationParts(location);
      const exact = requested.city
        ? eligible.filter(({ item }) => normalize(item.location).includes(requested.city))
        : eligible;
      const regional = requested.region
        ? eligible.filter(({ item }) => normalize(item.location).includes(requested.region))
        : exact;
      const filtered = !requested.city
        ? eligible
        : exact.length >= TARGET_RESULTS
          ? exact
          : Array.from(new Map([...exact, ...regional, ...eligible].map((entry) => [entry.item.id, entry])).values());

      const exactCount = requested.city ? exact.length : filtered.length;
      const regionalCount = requested.region ? regional.length : exactCount;
      const expansion = !requested.city
        ? "none"
        : exactCount >= TARGET_RESULTS
          ? "city"
          : regionalCount >= TARGET_RESULTS
            ? "region"
            : "coverage";

      const sorted = filtered.sort((a, b) => {
        if (sortBy === "price-low") return (a.item.priceValue ?? Number.MAX_SAFE_INTEGER) - (b.item.priceValue ?? Number.MAX_SAFE_INTEGER);
        if (sortBy === "price-high") return (b.item.priceValue ?? -1) - (a.item.priceValue ?? -1);
        if (sortBy === "cash-flow") return (b.item.cashFlowValue ?? -1) - (a.item.cashFlowValue ?? -1);
        if (sortBy === "revenue") return (b.item.revenueValue ?? -1) - (a.item.revenueValue ?? -1);
        if (requested.city) {
          const aExact = normalize(a.item.location).includes(requested.city) ? 1 : 0;
          const bExact = normalize(b.item.location).includes(requested.city) ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          const aRegional = requested.region && normalize(a.item.location).includes(requested.region) ? 1 : 0;
          const bRegional = requested.region && normalize(b.item.location).includes(requested.region) ? 1 : 0;
          if (aRegional !== bRegional) return bRegional - aRegional;
        }
        if (a.match?.score !== b.match?.score) return (b.match?.score ?? -1) - (a.match?.score ?? -1);
        return b.rank - a.rank;
      });
      return { results: sorted, exactCount, regionalCount, expansion };
    },
    [items, query, industry, source, sortBy, maxPrice, location, preferences],
  );
  const { results, exactCount, regionalCount, expansion } = searchResult;
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
        <label>
          {es ? "Buscar ubicación" : "Search location"}
          <input
            value={location}
            onChange={(event) => updateFilters(() => setLocation(event.target.value))}
            placeholder={es ? "Ciudad, Estado (ejemplo: Portland, OR)" : "City, State (example: Portland, OR)"}
            aria-label="Search location"
            list="crestview-location-suggestions"
            autoComplete="off"
          />
          <datalist id="crestview-location-suggestions">
            {LOCATION_SUGGESTIONS.map((suggestion) => <option value={suggestion} key={suggestion} />)}
          </datalist>
        </label>
        <div>
          <strong>{es ? "Búsqueda por ubicación" : "Location-first search"}</strong>
          <span>{es ? `Comienza con la ciudad y amplía la región hasta encontrar un máximo de ${TARGET_RESULTS} resultados.` : `Starts with the city, then expands through the region and current listing coverage until it reaches up to ${TARGET_RESULTS} results.`}</span>
        </div>
      </div>
      <div className="opportunity-filters" aria-label="Opportunity filters">
        <label>Industry<select value={industry} onChange={(event) => updateFilters(() => setIndustry(event.target.value))}>{industries.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Source<select value={source} onChange={(event) => updateFilters(() => setSource(event.target.value))}>{sources.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Maximum price<input value={maxPrice} onChange={(event) => updateFilters(() => setMaxPrice(event.target.value))} inputMode="numeric" placeholder="No maximum" /></label>
        <label>Sort by<select value={sortBy} onChange={(event) => updateFilters(() => setSortBy(event.target.value))}>
          <option value="relevance">Closest match</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="cash-flow">Highest cash flow</option>
          <option value="revenue">Highest revenue</option>
        </select></label>
        <button type="button" onClick={() => { setIndustry("All industries"); setSource("All sources"); setMaxPrice(""); setSortBy("relevance"); setLocation(""); setPage(1); }}>Reset filters</button>
      </div>
      {location.trim() && (
        <div className="location-expansion" role="status">
          <strong>{exactCount} exact city {exactCount === 1 ? "match" : "matches"}.</strong>
          <span>
            {expansion === "city" && ` Showing up to ${TARGET_RESULTS} listings in ${location}.`}
            {expansion === "region" && ` Expanded to the surrounding region, with ${regionalCount} regional matches.`}
            {expansion === "coverage" && ` Fewer than ${TARGET_RESULTS} were available nearby, so Crestview added the closest matches available in its current coverage.`}
          </span>
        </div>
      )}
      <div className="comparison-toolbar" aria-live="polite">
        <span>{selected.length} {es ? "seleccionados (máximo 4)" : "selected (maximum 4)"}</span>
        <Link className={`button button--light ${selected.length < 2 ? "is-disabled" : ""}`} aria-disabled={selected.length < 2} href={selected.length >= 2 ? `/${locale}/dashboard/opportunities/compare?ids=${selected.join(",")}` : `/${locale}/dashboard/opportunities`}>
          {es ? "Comparar seleccionados" : "Compare selected"}
        </Link>
        {selected.length > 0 && <button type="button" onClick={() => setSelected([])}>{es ? "Borrar selección" : "Clear selection"}</button>}
      </div>
      <div className="result-count"><strong>{results.length}</strong> opportunities found · showing {visibleResults.length} on page {safePage} of {pageCount}</div>
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
              <span className="source-label">{item.source} · checked {item.lastChecked}</span>
              <h2><Link href={`/${locale}/dashboard/opportunities/${item.id}`}>{item.title}</Link></h2>
              <p>{item.industry} · {item.location}</p>
              {match && <span className="match-explanation"><strong>{match.score}% match</strong>{match.reasons.length ? ` · ${match.reasons.join(", ")}` : " · criteria need review"}</span>}
            </div>
            <div><span>Asking price</span><strong>{item.price}</strong></div>
            <div><span>Revenue</span><strong>{item.revenue}</strong></div>
            <div><span>Cash flow / SDE</span><strong>{item.cashFlow}</strong></div>
            <div className="listing-status"><strong>{item.status}</strong><span>{item.publicBusinessName ? "Name public" : "Confidential"}</span></div>
            <Link className="save-button" href={`/${locale}/dashboard/opportunities/${item.id}`}>{es ? "Ver" : "View"}</Link>
          </article>
        ))}
        {results.length === 0 && <div className="empty-state"><h2>No close matches yet</h2><p>Try fewer words, a location, an industry, or one unusual word from the listing title.</p></div>}
      </div>
      {pageCount > 1 && (
        <nav className="opportunity-pagination" aria-label="Opportunity result pages">
          <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Previous</button>
          <span>Page {safePage} of {pageCount}</span>
          <button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next →</button>
        </nav>
      )}
      {!storageReady && <p className="search-help">Saving searches and opportunities will activate after Supabase is connected.</p>}
    </>
  );
}
