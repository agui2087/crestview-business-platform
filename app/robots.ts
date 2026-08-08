import type { MetadataRoute } from "next";

const siteUrl = "https://www.crestviewplatform.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/en/dashboard/", "/es/dashboard/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
