"use client";

/**
 * Admin-scoped error boundary. Mirrors the root error.tsx but includes
 * quick links to the admin dashboard, inventory, and orders so the
 * admin can recover without a hard refresh.
 */
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard, ClipboardList, Boxes } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-base)]">
      <div
        className="max-w-md w-full rounded-2xl p-6 text-center border border-[var(--border-subtle)]"
        style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
      >
        <div
          className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "oklch(0.55 0.20 15 / 0.15)", color: "oklch(0.55 0.20 15)" }}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Admin error
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-2">
          The admin module hit an unexpected error. Your changes are safe.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-[var(--text-disabled)] mb-4">
            ref: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 55), oklch(0.65 0.14 55))" }}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--text-disabled)]">
          <Link href="/admin/orders" className="hover:text-[var(--text-secondary)] inline-flex items-center gap-1">
            <ClipboardList className="w-3 h-3" /> Orders
          </Link>
          <span>·</span>
          <Link href="/admin/inventory" className="hover:text-[var(--text-secondary)] inline-flex items-center gap-1">
            <Boxes className="w-3 h-3" /> Inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
