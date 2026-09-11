import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Roboto_Mono } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { APP_DESCRIPTION } from "@/constants/app";

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";
const turnstileSiteKey = String(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
).trim();

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

const robotoMono = Roboto_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  applicationName: "Novae",
  description: APP_DESCRIPTION,
  formatDetection: { telephone: false },
  icons: {
    apple: [
      {
        url: `/apple-touch-icon-180x180.png?v=${appVersion}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
    icon: `/favicon.ico?v=${appVersion}`,
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: "Novae",
    template: "%s · Novae",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Novae",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  initialScale: 1,
  // The application is a fixed-scale surface: every layout already answers the
  // screen it is on, and a pinch that scales the page instead only takes the
  // navigation bar and the composer dock off it.
  maximumScale: 1,
  minimumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d121b" },
  ],
  userScalable: false,
  viewportFit: "cover",
  width: "device-width",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={`${inter.variable} ${robotoMono.variable}`}
    >
      <head>
        {turnstileSiteKey ? (
          <>
            <link
              crossOrigin="anonymous"
              href="https://challenges.cloudflare.com"
              rel="preconnect"
            />
            <link
              href="https://challenges.cloudflare.com"
              rel="dns-prefetch"
            />
            <link
              as="script"
              crossOrigin="anonymous"
              href="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
              nonce={nonce}
              rel="preload"
            />
          </>
        ) : null}
      </head>
      {/* Novae website brand, compact product density, shared light/dark surfaces and stable loading geometry. */}
      <body>
        <AppProviders nonce={nonce}>{children}</AppProviders>
        {turnstileSiteKey ? (
          <Script
            nonce={nonce}
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="beforeInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
