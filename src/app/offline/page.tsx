import type { Metadata } from "next";
import OfflineRetry from "./OfflineRetry";

export const metadata: Metadata = {
  title: "Offline — CaféSmart",
  description: "You are offline. Reconnect to continue using CaféSmart.",
};

/**
 * Offline fallback page — served by the service worker when a navigation
 * fails with no cached copy. Fully static: no DB, no auth, no data-fetching,
 * so it always renders even with zero connectivity.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full text-center">
        {/* Cloche mark (matches app icon) */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-3xl bg-[#171208] border border-white/10 flex items-center justify-center">
          <svg viewBox="0 0 512 512" className="w-12 h-12" aria-hidden="true">
            <path d="M218 118c-10 16 10 26 0 42M256 108c-10 16 10 26 0 42M294 118c-10 16 10 26 0 42"
              stroke="#EFA31A" strokeWidth="20" strokeLinecap="round" fill="none" />
            <path d="M116 300a140 140 0 0 1 280 0Z" fill="#EFA31A" />
            <circle cx="256" cy="146" r="22" fill="#EFA31A" />
            <rect x="96" y="300" width="320" height="26" rx="13" fill="#EFA31A" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          You&apos;re offline
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          No internet connection. Your cart and wallet are safe — reconnect to continue ordering.
        </p>

        <OfflineRetry />

        <p className="mt-6 text-[10px] text-[var(--text-disabled)]">
          CaféSmart works best online — browsing, payments and live order status need a connection.
        </p>
      </div>
    </div>
  );
}
