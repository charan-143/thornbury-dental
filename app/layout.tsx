import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Inter:wght@400;500;600&display=swap"
        />
        {/* Phosphor, the single icon family used across the project. */}
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
