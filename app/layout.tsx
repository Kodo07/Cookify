import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";

import { BootstrapReset } from "@/components/bootstrap-reset";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader"
});

export const metadata: Metadata = {
  title: "Cookify",
  description: "Turn any recipe into simple cooking flashcards.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions (for example Grammarly) may inject html/body attributes
    // before React hydrates, so suppress inevitable extension-only mismatches.
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${manrope.variable} ${newsreader.variable}`}
      >
        <BootstrapReset />
        {children}
      </body>
    </html>
  );
}
