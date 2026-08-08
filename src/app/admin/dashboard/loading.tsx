export default function AdminDashboardLoading() {
  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
          <div className="h-3 w-64 bg-white/5 rounded mt-2 animate-pulse" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(function (i) {
            return (
              <div key={i} className="rounded-2xl p-4 h-24 animate-pulse" style={{ background: "var(--glass-bg)" }} />
            );
          })}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-4 h-56 animate-pulse" style={{ background: "var(--glass-bg)" }} />
          <div className="rounded-2xl p-4 h-56 animate-pulse" style={{ background: "var(--glass-bg)" }} />
        </div>
        <div className="rounded-2xl p-4 h-32 animate-pulse" style={{ background: "var(--glass-bg)" }} />
      </div>
    </div>
  );
}
