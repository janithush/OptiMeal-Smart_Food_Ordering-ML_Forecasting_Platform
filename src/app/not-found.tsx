import Link from "next/link";
import { Home, Search } from "lucide-react";

/**
 * 404 — branded fallback for unknown routes.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[oklch(0.08_0.01_260)]">
      <div
        className="max-w-md w-full rounded-2xl p-6 text-center border border-[rgba(255,255,255,0.07)]"
        style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
      >
        <div
          className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "oklch(0.62 0.19 250 / 0.15)", color: "oklch(0.62 0.19 250)" }}
        >
          <Search className="w-6 h-6" />
        </div>
        <p className="text-5xl font-bold text-[var(--text-primary)] mb-2">404</p>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Page not found
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          The page you were looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 55), oklch(0.65 0.14 55))" }}
        >
          <Home className="w-4 h-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}
