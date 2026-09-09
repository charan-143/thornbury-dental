export default function ClinicLoading() {
  return (
    <div className="loading-container" aria-busy="true" aria-label="Loading page content...">
      <div className="loading-topbar">
        <div className="skeleton-shimmer" style={{ width: 180, height: 32 }} />
        <div className="skeleton-shimmer" style={{ width: 120, height: 32 }} />
      </div>
      <div className="loading-tiles">
        <div className="skeleton-shimmer loading-card" />
        <div className="skeleton-shimmer loading-card" />
        <div className="skeleton-shimmer loading-card" />
        <div className="skeleton-shimmer loading-card" />
      </div>
      <div className="skeleton-shimmer loading-panel" />
    </div>
  );
}
