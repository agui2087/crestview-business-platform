import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.crestviewplatform.com"),
  title: {
    default: "Crestview | Business ownership, made clearer",
    template: "%s | Crestview",
  },
  description:
    "Learn how to buy a small business, explore opportunities, complete due diligence, compare financing, and manage your acquisition in one guided platform.",
  keywords: [
    "how to buy a business",
    "buying a business for beginners",
    "small business for sale",
    "business due diligence checklist",
    "business acquisition financing",
    "small business valuation",
  ],
  icons: {
    icon: [
      { url: "/crestview-favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/crestview-favicon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/crestview-favicon-48.png",
    apple: "/crestview-favicon.svg",
  },
  openGraph: {
    title: "Crestview | Find. Evaluate. Acquire.",
    description:
      "Learn how to buy a business and move from search through evaluation, financing, due diligence, and acquisition.",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Crestview business acquisition platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crestview | Find. Evaluate. Acquire.",
    description:
      "Learn how to buy a business and move from search through evaluation, financing, due diligence, and acquisition.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.crestviewplatform.com/#organization",
        name: "Crestview",
        url: "https://www.crestviewplatform.com",
        description:
          "A business operating platform for finding, evaluating, acquiring, and operating small businesses.",
        logo: "https://www.crestviewplatform.com/crestview-mark.svg",
      },
      {
        "@type": "WebSite",
        "@id": "https://www.crestviewplatform.com/#website",
        url: "https://www.crestviewplatform.com",
        name: "Crestview",
        publisher: {
          "@id": "https://www.crestviewplatform.com/#organization",
        },
        inLanguage: ["en", "es"],
      },
    ],
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
