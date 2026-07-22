import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
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
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ClerkProvider dynamic>
          <header className="border-b border-card-border bg-card">
            <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-6 py-4">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-brand text-sm font-bold text-brand-foreground">
                  A
                </span>
                <span className="font-display text-lg font-bold tracking-tight">
                  AutoEstate
                </span>
                <span className="text-sm text-gray-500">Agent Activity</span>
              </Link>
              <Show when="signed-out">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <SignInButton />
                  <SignUpButton />
                </div>
              </Show>
              <Show when="signed-in">
                <div className="flex items-center gap-4 text-sm font-medium">
                  <Link href="/settings" className="text-gray-500 hover:text-foreground">
                    Settings
                  </Link>
                  <UserButton />
                </div>
              </Show>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
