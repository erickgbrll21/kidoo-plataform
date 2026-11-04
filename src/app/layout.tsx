import type { Metadata, Viewport } from "next";
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
  title: { default: "KIDOO HUB", template: "%s · KIDOO HUB" },
  description: "KIDOO HUB — atendimento omnichannel, CRM e agentes de IA em uma única plataforma. BUILD. AUTOMATE. GROW.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#353F34",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
