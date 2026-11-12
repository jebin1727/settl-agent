import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { MotionProvider } from "@/providers/MotionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SettlAgent",
  description: "Autonomous settlement and dispute-triage agent for PayPal, built for the PayPal AI Hackathon 2026",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ThemeProvider>
          <QueryProvider>
            <MotionProvider>{children}</MotionProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
