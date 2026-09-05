"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Retry controls for the offline fallback page.
 * Auto-returns home the moment connectivity is restored.
 */
export default function OfflineRetry() {
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setBackOnline(true);
      window.location.replace("/");
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => window.location.reload()}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
        style={{ background: "var(--brand)", color: "#000" }}
      >
        {backOnline ? "Back online — reconnecting…" : "Try again"}
      </button>
      <Link
        href="/"
        className="w-full py-3 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-all text-center"
      >
        Go to home
      </Link>
    </div>
  );
}
