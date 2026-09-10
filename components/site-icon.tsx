const paths = {
  home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
  search: "M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  list: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1",
  inbox: "M4 4h16v16H4zM4 13h5l1 3h4l1-3h5",
  heart: "M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5Z",
  pipeline: "M3 3h6v6H3zM15 15h6v6h-6zM9 6h9v9",
  check: "m4 12 5 5L20 6",
  chart: "M4 3v17h17M8 16v-5M13 16V7M18 16V4",
  document: "M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h8",
  message: "M3 3h18v14H9l-6 4zM7 7h10M7 11h7",
  people: "M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 21v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6M18 13a4 4 0 0 1 3 4v4",
  card: "M3 5h18v14H3zM3 10h18M6 15h4",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4M12 2v2",
  menu: "M3 6h18M3 12h18M3 18h18",
  down: "m6 9 6 6 6-6",
  arrow: "M3 12h18m-7-7 7 7-7 7",
  external: "M5 19 19 5M7 5h12v12",
  scroll: "M12 3v18m-6-6 6 6 6-6",
  lock: "M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3",
  globe: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18",
} as const;

/** Decorative only: the surrounding link/button supplies its accessible name. */
export function SiteIcon({ name }: { name: keyof typeof paths }) {
  return <svg aria-hidden="true" focusable="false" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-0.125em", flexShrink: 0 }}><path d={paths[name]} /></svg>;
}
