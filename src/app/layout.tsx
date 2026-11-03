import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { getSite } from "@/lib/content/load";
import { MODE_SCRIPT } from "@/lib/webgl";
import "./globals.css";
import "@/components/kit/tokens.css";

// latin-ext covers Turkish (Ö, ş, ğ, ı, İ). The pixel face is only drawn by the LED ticker on the
// desk (a canvas), so it isn't preloaded.
const sans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap", preload: false });
const pixel = Pixelify_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-pixel", display: "swap", preload: false });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export function generateMetadata(): Metadata {
  const site = getSite();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: site.seo.title, template: `%s · ${site.name}` },
    description: site.seo.description,
    openGraph: { title: site.seo.title, description: site.seo.description, type: "website", siteName: site.name },
    twitter: { card: "summary_large_image", title: site.seo.title, description: site.seo.description },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9E3D8" },
    { media: "(prefers-color-scheme: dark)", color: "#141824" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${pixel.variable}`} suppressHydrationWarning>
      <head>
        {/* Decides room vs text layout before first paint (see src/lib/webgl.ts). */}
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
