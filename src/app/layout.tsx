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

export const metadata: Metadata = {
  title: "Sotto — Confidential token distribution",
  description:
    "Distribute tokens to any number of recipients in a single confidential transaction. Amounts stay encrypted onchain — only each recipient can decrypt what's theirs. Built on FHE and the TokenOps SDK.",
  keywords: ["FHE", "confidential", "ERC-7984", "TokenOps", "Zama", "airdrop", "disperse"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
