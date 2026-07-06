import type { Metadata } from "next";
import { Inter, Quicksand } from "next/font/google";
import "./globals.css";
import { BackgroundTriangles } from "@/app/components/BackgroundTriangles";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Quicksand stands in for osu!'s proprietary Torus typeface
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-quicksand",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Retrace",
    template: "%s · Retrace",
  },
  description:
    "Replay autopsy for osu!standard: hit-by-hit reconstruction, tap and aim style, farm maps priced by real pp gain, player and country deep dives.",
  applicationName: "Retrace",
  openGraph: {
    title: "Retrace",
    description:
      "Drop an .osr, get the autopsy. UR, timing bias, tap style, miss map and a coach that reads the numbers.",
    url: SITE_URL,
    siteName: "Retrace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Retrace",
    description: "Replay autopsy and informatics for osu!standard.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <BackgroundTriangles />
        {children}
      </body>
    </html>
  );
}
