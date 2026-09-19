import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegistration } from "@/components/pwa-registration";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Talkingston",
  description: "A thoughtful companion for your everyday life.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0d1b3e",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Talkingston" },
  icons: { icon: "/talkingston-icon-192.svg", apple: "/talkingston-icon-192.svg" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
