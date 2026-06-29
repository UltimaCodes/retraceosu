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

export const metadata: Metadata = {
  title: "Retrace",
  description: "Replay autopsy and playstyle profiling for osu!",
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
