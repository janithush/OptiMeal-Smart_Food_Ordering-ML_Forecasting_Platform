export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="sticky top-0 z-10 bg-[var(--bg-base)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {[1, 2, 3, 4].map(function (i) {
          return (
            <div key={i} className="rounded-xl p-4 h-24 animate-pulse" style={{ background: "var(--glass-bg)" }} />
          );
        })}
      </div>
    </div>
  );
}
