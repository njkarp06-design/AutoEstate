import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { Assistant, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Assistant carries both body copy and Hebrew glyphs - this app's real
// content is bilingual, so the body face needs genuine Hebrew coverage,
// not a system-font fallback.
const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["latin", "hebrew"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
      className={`${assistant.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ClerkProvider dynamic>
          <header className="border-b border-card-border">
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-6 py-5">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-card-border font-display text-sm font-semibold italic">
                  Ae
                </span>
                <span className="flex flex-col leading-none">
                  <span className="font-display text-lg font-semibold tracking-tight">
                    AutoEstate
                  </span>
                  <span className="mt-1 font-mono text-[0.65rem] uppercase tracking-widest text-status-muted">
                    Agent Activity
                  </span>
                </span>
              </Link>
              <Show when="signed-out">
                <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wide">
                  <SignInButton />
                  <SignUpButton />
                </div>
              </Show>
              <Show when="signed-in">
                <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wide">
                  <Link href="/settings" className="text-status-muted hover:text-foreground">
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
