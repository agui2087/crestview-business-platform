"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Opportunity } from "@/lib/demo-data";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

export function OpportunitySearch({
  items,
  locale,
  storageReady,
}: {
  items: Opportunity[];
  locale: string;
  storageReady: boolean;
}) {
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("All industries");
  const [source, setSource] = useState("All sources");
  const [sortBy, setSortBy] = useState("relevance");
  const [maxPrice, setMaxPrice] = useState("");
  const industries = useMemo(
    () => ["All industries", ...Array.from(new Set(items.map((item) => item.industry))).sort()],
    [items],
  );
  const sources = useMemo(
    () => ["All sources", ...Array.from(new Set(items.map((item) => item.source))).sort()],
    [items],
  );
  const results = useMemo(
    () => {
      const ceiling = Number(maxPrice.replace(/[$,\s]/g, ""));
      const filtered = items
        .map((item) => ({ item, rank: score(item, query) }))
        .filter(({ item, rank }) =>
          rank > 0
          && (industry === "All industries" || item.industry === industry)
          && (source === "All sources" || item.source === source)
          && (!ceiling || (item.priceValue !== null && item.priceValue <= ceiling)),
        );
      return filtered.sort((a, b) => {
        if (sortBy === "price-low") return (a.item.priceValue ?? Number.MAX_SAFE_INTEGER) - (b.item.priceValue ?? Number.MAX_SAFE_INTEGER);
        if (sortBy === "price-high") return (b.item.priceValue ?? -1) - (a.item.priceValue ?? -1);
        if (sortBy === "cash-flow") return (b.item.cashFlowValue ?? -1) - (a.item.cashFlowValue ?? -1);
        if (sortBy === "revenue") return (b.item.revenueValue ?? -1) - (a.item.revenueValue ?? -1);
        return b.rank - a.rank;
      });
    },
    [items, query, industry, source, sortBy, maxPrice],
  );

  return (
    <>
      <div className="smart-search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe the business or enter any words you remember" aria-label="Search opportunities" />
        {query && <button onClick={() => setQuery("")} type="button">Clear</button>}
      </div>
      <p className="search-help">Searches titles, descriptions, industries, locations, and partial word matches. The closest matches appear first.</p>
      <div className="opportunity-filters" aria-label="Opportunity filters">
        <label>Industry<select value={industry} onChange={(event) => setIndustry(event.target.value)}>{industries.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Source<select value={source} onChange={(event) => setSource(event.target.value)}>{sources.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Maximum price<input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="numeric" placeholder="No maximum" /></label>
        <label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="relevance">Closest match</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="cash-flow">Highest cash flow</option>
          <option value="revenue">Highest revenue</option>
        </select></label>
        <button type="button" onClick={() => { setIndustry("All industries"); setSource("All sources"); setMaxPrice(""); setSortBy("relevance"); }}>Reset filters</button>
      </div>
      <div className="result-count"><strong>{results.length}</strong> opportunities shown</div>
      <div className="opportunity-list">
        {results.map(({ item }) => (
          <article className="opportunity-row" key={item.id}>
            <div className="opportunity-row__main">
              <span className="source-label">{item.source} · checked {item.lastChecked}</span>
              <h2><Link href={`/${locale}/dashboard/opportunities/${item.id}`}>{item.title}</Link></h2>
              <p>{item.industry} · {item.location}</p>
            </div>
            <div><span>Asking price</span><strong>{item.price}</strong></div>
            <div><span>Revenue</span><strong>{item.revenue}</strong></div>
            <div><span>Cash flow / SDE</span><strong>{item.cashFlow}</strong></div>
            <div className="listing-status"><strong>{item.status}</strong><span>{item.publicBusinessName ? "Name public" : "Confidential"}</span></div>
            <Link className="save-button" href={`/${locale}/dashboard/opportunities/${item.id}`}>View</Link>
          </article>
        ))}
        {results.length === 0 && <div className="empty-state"><h2>No close matches yet</h2><p>Try fewer words, a location, an industry, or one unusual word from the listing title.</p></div>}
      </div>
      {!storageReady && <p className="search-help">Saving searches and opportunities will activate after Supabase is connected.</p>}
    </>
  );
}
