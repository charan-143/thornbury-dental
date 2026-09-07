"use client";

/**
 * Route error boundary.
 *
 * Next renders this when a page throws. Without it, a database outage shows a
 * raw framework error page, which tells a clinician nothing useful and tells a
 * stranger more than it should.
 *
 * The message says what to do rather than what went wrong. The digest is
 * included because it is the one token tying what someone saw on screen to the
 * entry in the server log, and it carries no detail of its own.
 */

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="wrap" id="main" style={{ paddingBlock: 64, maxWidth: 640 }}>
      <h1>This page could not be loaded</h1>

      <div className="alert alert-critical" role="alert" style={{ marginTop: 20 }}>
        <i className="ph ph-warning-octagon" aria-hidden="true" />
        <span>
          Something went wrong reaching the practice records. Nothing you were doing has
          been saved. Try again in a moment, and if it keeps happening tell whoever looks
          after the system.
        </span>
      </div>

      <div className="chip-row" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" type="button" onClick={reset}>
          Try again
        </button>
        <a className="btn btn-secondary" href="/clinic">Back to the workspace</a>
      </div>

      {error.digest && (
        <p className="meta" style={{ marginTop: 20 }}>
          Reference <span className="mono">{error.digest}</span>. Quote this if you report it.
        </p>
      )}
    </main>
  );
}
