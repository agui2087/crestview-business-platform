import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.crestviewplatform.com"),
  title: {
    default: "Crestview | Business ownership, made clearer",
    template: "%s | Crestview",
  },
  description:
    "A business operating platform for finding, evaluating, acquiring, and operating small businesses.",
  openGraph: {
    title: "Crestview | Find. Evaluate. Acquire.",
    description:
      "Search sourced business opportunities and move from initial review through acquisition.",
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
      "Search sourced business opportunities and move from initial review through acquisition.",
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
