import Link from "next/link";

/**
 * 404 Not Found page component.
 */

export default function NotFound() {
  return (
    <main className="wrap" id="main" style={{ paddingBlock: 64, maxWidth: 640 }}>
      <h1>Page Not Found</h1>
      <p className="page-intro" style={{ marginTop: 12 }}>
        The page or record you are looking for does not exist or may have been moved.
      </p>

      <div className="chip-row" style={{ marginTop: 20 }}>
        <Link className="btn btn-primary" href="/clinic">
          Go to Practice Workspace
        </Link>
        <Link className="btn btn-secondary" href="/clinic/patients">
          View Patients List
        </Link>
      </div>
    </main>
  );
}
