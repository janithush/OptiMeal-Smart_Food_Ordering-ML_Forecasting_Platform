"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, X, Check, AlertCircle } from "lucide-react";

interface Props {
  onClose: () => void;
  onScan: (qrCode: string) => Promise<{ success: boolean; orderNumber?: string; studentName?: string; error?: string }>;
}

export default function QRScanner({ onClose, onScan }: Props) {
  const [mode, setMode] = useState<"camera" | "manual">("manual");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera on close
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("camera");
    } catch {
      setMode("manual");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Synchronize with the camera (external system) — the parent remounts this
  // component each time the scanner is opened, so we no longer reset local
  // state here. The only state update is the camera-failure fallback,
  // wrapped in an async IIFE so it sits behind an `await`.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await startCamera();
      } catch {
        if (!cancelled) setMode("manual");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleManualSubmit = async () => {
    const code = manualCode.trim();
    if (!code) return;
    setScanning(true);
    setResult(null);
    try {
      const res = await onScan(code);
      if (res.success) {
        setResult({ success: true, message: `${res.studentName} · ${res.orderNumber}` });
        setManualCode("");
      } else {
        setResult({ success: false, message: res.error ?? "Scan failed" });
      }
    } catch {
      setResult({ success: false, message: "Network error" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 pb-8"
          style={{
            background: "oklch(0.12 0.01 260)",
            border: "1px solid var(--glass-border)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Scan QR Code</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* Camera view */}
          {mode === "camera" && (
            <div className="relative rounded-xl overflow-hidden bg-black mb-4 aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 border-2 border-[var(--brand)]/40 rounded-xl" />
              <button
                onClick={() => { stopCamera(); setMode("manual"); }}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 text-white text-xs"
              >
                Type Code Instead
              </button>
            </div>
          )}

          {/* Manual input */}
          {mode === "manual" && (
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  placeholder="Paste QR code value (e.g. CAF-SMART-...)"
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--brand)]/50"
                  autoFocus
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={scanning || !manualCode.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--brand)] text-black text-sm font-bold disabled:opacity-40 flex items-center gap-1"
                >
                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Scan"}
                </button>
              </div>
              <button
                onClick={startCamera}
                className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <Camera className="w-3.5 h-3.5" />
                Use camera instead
              </button>
            </div>
          )}

          {/* Result */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                result.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {result.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {result.message}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
