export default function StudentHomeLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] pb-20">
      <div className="sticky top-0 z-10 bg-[var(--bg-base)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="h-6 w-48 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="rounded-2xl p-4 h-12 animate-pulse" style={{ background: "var(--glass-bg)" }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(function (i) {
            return (
              <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: "var(--glass-bg)" }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}
