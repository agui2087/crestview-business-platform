import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://crestview-business-platform.agui2087.chatgpt.site"),
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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
