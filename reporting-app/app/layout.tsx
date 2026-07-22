import type { Metadata } from "next";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "AutoEstate — Agent Activity",
  description: "Read-only view of what the AutoEstate agent has done.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-card-border bg-card">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
                A
              </span>
              <span className="text-lg font-semibold tracking-tight">
                AutoEstate
              </span>
            </Link>
            <span className="text-sm text-gray-500">Agent Activity</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
