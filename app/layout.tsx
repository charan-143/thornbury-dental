import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thornbury Dental",
  description:
    "Dental practice site with a patient portal and a clinician workspace: appointments, pre and post treatment plans, prescriptions, medication reminders and reports.",
  robots: {
    // A portal holding health records should not be indexed. The public pages
    // would be opened up individually in a real deployment.
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <head>
        {/* Preconnect and load Phosphor icon stylesheet */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css" />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to the main content</a>
        <p className="demo-strip">
          A demonstration build with invented records. Do not enter real patient information.
        </p>
        {children}
      </body>
    </html>
  );
}
