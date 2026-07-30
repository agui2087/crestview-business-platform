"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({
  locale,
  compact = false,
  inverse = false,
}: {
  locale: Locale;
  compact?: boolean;
  inverse?: boolean;
}) {
  const pathname = usePathname();
  const nextLocale: Locale = locale === "en" ? "es" : "en";
  const segments = pathname.split("/");
  if (segments[1] === "en" || segments[1] === "es") segments[1] = nextLocale;
  const destination = segments.join("/") || `/${nextLocale}`;
  const href = `/api/locale?locale=${nextLocale}&return_to=${encodeURIComponent(destination)}`;

  return (
    <a
      className={`language-switcher${compact ? " language-switcher--compact" : ""}${inverse ? " language-switcher--inverse" : ""}`}
      href={href}
      hrefLang={nextLocale}
      lang={nextLocale}
      aria-label={locale === "en" ? "Cambiar todo a español" : "Switch everything to English"}
    >
      <span aria-hidden="true">◎</span>
      {compact ? (nextLocale === "es" ? "ES" : "EN") : (nextLocale === "es" ? "Español" : "English")}
    </a>
  );
}
