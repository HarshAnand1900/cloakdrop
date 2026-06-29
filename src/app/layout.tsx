import type { Metadata } from "next";
import { Instrument_Serif, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ToastViewport } from "@/components/toast";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--next-font-serif",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--next-font-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--next-font-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cloakdrop.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Sotto",
  title: {
    default: "Sotto — Confidential token distribution",
    template: "%s · Sotto",
  },
  description:
    "Distribute tokens to any number of recipients in a single confidential transaction. Amounts stay encrypted onchain — only each recipient can decrypt what's theirs. Built on FHE and the TokenOps SDK.",
  keywords: ["FHE", "confidential", "ERC-7984", "TokenOps", "Zama", "airdrop", "disperse", "crypto", "privacy"],
  authors: [{ name: "Sotto" }],
  openGraph: {
    title: "Sotto — Confidential token distribution",
    description: "Pay everyone. Publish nothing. FHE-encrypted airdrops and disperse on Ethereum.",
    url: SITE_URL,
    siteName: "Sotto",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Sotto — Confidential token distribution",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sotto — Confidential token distribution",
    description: "Pay everyone. Publish nothing. FHE-encrypted airdrops on Ethereum.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${instrumentSerif.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable}`}
        style={{ fontFamily: "var(--next-font-sans, 'Hanken Grotesk', system-ui, sans-serif)" }}
      >
        <Providers>
          {children}
          <ToastViewport />
        </Providers>
      </body>
    </html>
  );
}
