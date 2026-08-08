import type { MetadataRoute } from "next";

const siteUrl = "https://www.crestviewplatform.com";

const publicRoutes = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/listings", changeFrequency: "daily", priority: 0.9 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/vision", changeFrequency: "monthly", priority: 0.7 },
  { path: "/real-estate", changeFrequency: "monthly", priority: 0.6 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.flatMap(({ path, changeFrequency, priority }) =>
    (["en", "es"] as const).map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          en: `${siteUrl}/en${path}`,
          es: `${siteUrl}/es${path}`,
          "x-default": `${siteUrl}/en${path}`,
        },
      },
    })),
  );
}
