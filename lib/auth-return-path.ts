// Only resume same-locale application pages. Never redirect to an arbitrary host,
// API endpoint, authentication loop, or encoded path separator.
export function authReturnPath(value: unknown, locale: string) {
  const language = locale === "es" ? "es" : "en";
  const fallback = `/${language}/dashboard`;
  if (typeof value !== "string" || value.length > 2000 || /[\\\u0000-\u0020]|%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(value)) return fallback;
  if (!value.startsWith(`/${language}/`)) return fallback;
  try {
    const url = new URL(value, "https://crestview.invalid");
    if (url.origin !== "https://crestview.invalid" || !url.pathname.startsWith(`/${language}/`)) return fallback;
    if (/^\/(en|es)\/(sign-in|create-account)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
