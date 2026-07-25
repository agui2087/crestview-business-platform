import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Crestview | Business ownership, made clearer",
    template: "%s | Crestview",
  },
  description:
    "A business operating platform for finding, evaluating, acquiring, and operating small businesses.",
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
