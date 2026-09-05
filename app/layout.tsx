import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.crestviewplatform.com"),
  title: {
    default: "Crestview Platform | Buy a Business with Confidence",
    template: "%s | Crestview Platform",
  },
  description:
    "Crestview Platform helps first-time and experienced buyers find, evaluate, finance, and purchase a small business with guided tools in one place.",
  keywords: [
    "how to buy a business",
    "buying a business for beginners",
    "small business for sale",
    "business due diligence checklist",
    "business acquisition financing",
    "small business valuation",
    "Crestview Platform",
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
    title: "Crestview Platform | Find. Evaluate. Acquire.",
    description:
      "Learn how to buy a business and move from search through evaluation, financing, due diligence, and acquisition.",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Crestview Platform for buying and operating a business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crestview Platform | Find. Evaluate. Acquire.",
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
        name: "Crestview Platform",
        alternateName: "Crestview",
        url: "https://www.crestviewplatform.com",
        description:
          "A business operating platform for finding, evaluating, acquiring, and operating small businesses.",
        logo: "https://www.crestviewplatform.com/crestview-mark.svg",
      },
      {
        "@type": "WebSite",
        "@id": "https://www.crestviewplatform.com/#website",
        url: "https://www.crestviewplatform.com",
        name: "Crestview Platform",
        alternateName: "Crestview",
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
