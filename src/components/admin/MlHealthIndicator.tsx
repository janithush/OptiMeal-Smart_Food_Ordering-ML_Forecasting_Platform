"use client";

/**
 * MlHealthIndicator — Small status dot shown in the admin header.
 * Polls /api/ml/health every 30s. Green when the ML service responds
 * with status="ok", red when it errors, amber while loading.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type MlStatus = "ok" | "error" | "loading" | "unknown";

interface MlHealthResponse {
  status?: string;
  models_loaded?: number;
  message?: string;
}

export default function MlHealthIndicator() {
  const [status, setStatus] = useState<MlStatus>("loading");
  const [modelsLoaded, setModelsLoaded] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/ml/health", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const json: MlHealthResponse = await res.json();
          if (json.status === "ok") {
            setStatus("ok");
            setModelsLoaded(json.models_loaded ?? null);
            setMessage(null);
          } else {
            setStatus("error");
            setMessage(json.message ?? "ML service error");
          }
        } else {
          setStatus("error");
          setMessage(`HTTP ${res.status}`);
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage((err as Error).message);
      }
    };

    fetchHealth();
    const id = setInterval(fetchHealth, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const color =
    status === "ok"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : status === "loading"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
      : "text-red-400 bg-red-500/10 border-red-500/20";

  const Icon =
    status === "ok" ? CheckCircle2 : status === "loading" ? Loader2 : AlertCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border ${color}`}
      title={
        status === "ok"
          ? `ML service online${modelsLoaded !== null ? ` (${modelsLoaded} models loaded)` : ""}`
          : message ?? "ML status unknown"
      }
    >
      <Icon className={`w-3 h-3 ${status === "loading" ? "animate-spin" : ""}`} />
      <Cpu className="w-3 h-3" />
      <span className="hidden sm:inline">
        ML {status === "ok" ? "Online" : status === "loading" ? "..." : "Offline"}
      </span>
    </motion.div>
  );
}
