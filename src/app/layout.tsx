import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://megallm.io"),
  title: {
    template: "%s | MegaLLM — Unified LLM API",
    default: "MegaLLM — One API for 70+ AI Models",
  },
  description:
    "Unified LLM API gateway — one API for 70+ AI models with automatic routing to the best, cheapest provider with highest uptime.",
  openGraph: {
    type: "website",
    siteName: "MegaLLM",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "MegaLLM",
              url: "https://megallm.io",
              description:
                "Unified LLM API gateway — one API for 70+ AI models with automatic routing to the best, cheapest provider",
              sameAs: [
                "https://github.com/megallm",
                "https://twitter.com/megallm",
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
