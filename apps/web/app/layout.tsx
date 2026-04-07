import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { renderWebDesignCssVariables } from "@mobile-mechanic/core";
import "maplibre-gl/dist/maplibre-gl.css";

import "./globals.css";
import "./design-system.css";

const displayFont = IBM_Plex_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui-display",
  weight: ["400", "500", "600", "700"]
});

const bodyFont = IBM_Plex_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui-body",
  weight: ["400", "500", "600", "700"]
});

const monoFont = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui-mono",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Mobile Mechanic Software",
  description: "Office operations dashboard for the Mobile Mechanic platform."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
    >
      <head>
        <style id="design-system-tokens">{renderWebDesignCssVariables()}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
