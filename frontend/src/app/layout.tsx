import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Fraunces } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { LangProvider } from "@/lib/i18n";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://cermin-saku-monad.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Cermin Saku — uang saku dari MON-mu yang tahu kapan menahan diri",
  description:
    "Kirim uang saku ke anak dari vault MON di Monad, tepat di detik jatuh temponya. MON-mu tetap utuh, dan kontraknya menahan pembayaran sendiri saat pasar sedang jatuh.",
  openGraph: {
    title: "Cermin Saku",
    description: "Uang saku dari MON-mu, tepat waktu di Monad. Kontraknya menahan pembayaran sendiri saat posisi tidak aman.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F8F6F1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables sit on <html> so the @theme tokens (defined on :root) resolve them.
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}>
      <body className="text-ink antialiased font-sans">
        <LangProvider>
          <Web3Provider>
            <SmoothScroll>{children}</SmoothScroll>
          </Web3Provider>
        </LangProvider>
        <div aria-hidden className="grain" />
      </body>
    </html>
  );
}
