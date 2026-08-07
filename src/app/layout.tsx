import type { Metadata, Viewport } from "next";
import { Zilla_Slab, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const displayFont = Zilla_Slab({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const sansFont = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const DESCRIPTION =
  "Casefile tracks your applications from your inbox, surfaces who you already know at every company, and turns the chaos into one chart.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Casefile — Applied. Tracked. Repeat.",
  description: DESCRIPTION,
  openGraph: {
    title: "Casefile — Applied. Tracked. Repeat.",
    description: DESCRIPTION,
    siteName: "Casefile",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#e9edf0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#101820",
          colorBackground: "#e9edf0",
          colorForeground: "#101820",
          colorMutedForeground: "#52616f",
          colorInput: "#e9edf0",
          colorInputForeground: "#101820",
          colorNeutral: "#52616f",
          borderRadius: "4px",
          fontFamily: "var(--font-sans)",
        },
      }}
    >
      <html
        lang="en"
        className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
          <div className="h-1 w-full bg-cobalt" aria-hidden="true" />
          {children}
          <SpeedInsights />
        </body>
        {/* Unset in local/dev — only Vercel's production env needs a real measurement ID. */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </html>
    </ClerkProvider>
  );
}
