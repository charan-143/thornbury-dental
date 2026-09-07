"use client";

/**
 * Last-resort error boundary.
 *
 * This catches failures in the root layout itself, which the ordinary
 * error.tsx sits inside and therefore cannot handle. It replaces the whole
 * document, so unlike every other component here it renders its own html and
 * body tags.
 *
 * It also has to stand on its own: the stylesheet is loaded by the root
 * layout, and if that is what failed there is no CSS. The few styles below are
 * inline for that reason, and deliberately plain.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "64px 24px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#faf9f5",
          color: "#3d3d3a",
          lineHeight: 1.55,
        }}
      >
        <main style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ font: "400 2rem/1.15 Georgia, serif", color: "#141413", margin: 0 }}>
            Thornbury Dental is temporarily unavailable
          </h1>
          <p style={{ marginTop: 16 }}>
            The system could not start up properly. Nothing you were doing has been saved.
            Try again shortly, and if it keeps happening tell whoever looks after the system.
          </p>
          <p style={{ marginTop: 16 }}>
            If a patient is waiting and this is urgent, work on paper and telephone the
            practice on +1 (503) 224-7700.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#b25c3e",
              color: "#ffffff",
              font: "500 0.875rem/1 system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: "0.875rem", color: "#63615b" }}>
              Reference <code>{error.digest}</code>. Quote this if you report it.
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
