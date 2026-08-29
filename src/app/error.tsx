"use client";

/**
 * Root error boundary — catches any unhandled error in the App Router
 * (route handlers, server components, client components) and renders a
 * branded fallback instead of the default Next.js 500 page.
 *
 * Per Next.js 15+ App Router conventions, this MUST be a Client
 * Component and MUST define the "error" and "reset" props.
 */
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the server console (or your APM of choice in production)
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[oklch(0.08_0.01_260)]">
      <div
        className="max-w-md w-full rounded-2xl p-6 text-center border border-[rgba(255,255,255,0.07)]"
        style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}
      >
        <div
          className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "oklch(0.55 0.20 15 / 0.15)", color: "oklch(0.55 0.20 15)" }}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-[var(--text-disabled)] mb-4">
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 55), oklch(0.65 0.14 55))" }}
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
