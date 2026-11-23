import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, TOURNAMENT_FULL_NAME, TOURNAMENT_SHORT_NAME } from "@/lib/brand";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const TITLE = `${TOURNAMENT_SHORT_NAME} — live scores`;
const DESCRIPTION = `${TOURNAMENT_FULL_NAME}. ${SITE_DESCRIPTION}`;

// Absolute base for share-image URLs: NEXT_PUBLIC_SITE_URL if set, else the Vercel
// production domain, else localhost (local runs only).
function siteUrl(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL("http://localhost:3000");
}

// Share images, favicon and app icons come from the files in src/app
// (opengraph-image.jpg, twitter-image.jpg, favicon.ico, icon.png, apple-icon.png).
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TOURNAMENT_SHORT_NAME,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TOURNAMENT_SHORT_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#135463",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}>
      <body className="min-h-dvh bg-bg font-sans text-text">{children}</body>
    </html>
  );
}
