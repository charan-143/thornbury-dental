export default function RootLoading() {
  return (
    <div className="loading-container" aria-busy="true" aria-label="Loading...">
      <div className="skeleton-shimmer" style={{ width: "100%", height: 64, marginBottom: 24 }} />
      <div className="skeleton-shimmer" style={{ width: "60%", height: 48, marginBottom: 16 }} />
      <div className="skeleton-shimmer" style={{ width: "40%", height: 24, marginBottom: 32 }} />
      <div className="skeleton-shimmer loading-panel" />
    </div>
  );
}
