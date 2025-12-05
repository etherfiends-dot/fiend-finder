import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_URL || "https://fiend-finder.vercel.app";

export const metadata: Metadata = {
  title: "Soul Scanner - NFT Viewer",
  description: "View NFTs across all your linked wallets on Base",
  openGraph: {
    title: "Soul Scanner",
    description: "View NFTs across all your linked wallets on Base",
    images: [`${appUrl}/og-image.png`],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${appUrl}/og-image.png`,
    "fc:frame:button:1": "Scan My NFTs",
    "fc:frame:post_url": `${appUrl}/api/frame`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
