import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";

const siteUrl = "https://www.crestviewplatform.com";

export function localizedPublicMetadata(
  locale: Locale,
  path: "" | "/listings" | "/how-it-works" | "/pricing" | "/vision" | "/real-estate",
  metadata: Metadata,
): Metadata {
  const canonical = `${siteUrl}/${locale}${path}`;

  return {
    ...metadata,
    alternates: {
      canonical,
      languages: {
        en: `${siteUrl}/en${path}`,
        es: `${siteUrl}/es${path}`,
        "x-default": `${siteUrl}/en${path}`,
      },
    },
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
      locale: locale === "es" ? "es_US" : "en_US",
      alternateLocale: locale === "es" ? ["en_US"] : ["es_US"],
    },
  };
}
