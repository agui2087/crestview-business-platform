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
  const results = useMemo(
    () => items.map((item) => ({ item, rank: score(item, query) })).filter(({ rank }) => rank > 0).sort((a, b) => b.rank - a.rank),
    [items, query],
  );

  return (
    <>
      <div className="smart-search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe the business or enter any words you remember" aria-label="Search opportunities" />
        {query && <button onClick={() => setQuery("")} type="button">Clear</button>}
      </div>
      <p className="search-help">Searches titles, descriptions, industries, locations, and partial word matches. The closest matches appear first.</p>
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
