"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { generateQRDataURL } from "@/lib/qr";

interface Props {
  orderId: string;
  orderDate: string;
  qrCodeString: string;
  size?: number;
}

/**
 * Returns YYYY-MM-DD in the LOCAL timezone for a date value.
 * Uses toLocaleDateString('en-CA') which always produces YYYY-MM-DD.
 */
function toLocalDateStr(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-CA"); // en-CA = YYYY-MM-DD format
}

function isToday(dateStr: string): boolean {
  const orderDay = toLocalDateStr(dateStr);
  const today = toLocalDateStr(new Date());
  return orderDay === today;
}

export default function QRDisplay({ orderId, orderDate, qrCodeString, size = 200 }: Props) {
  const valid = isToday(orderDate);
  const [dataURL, setDataURL] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    generateQRDataURL(orderId)
      .then((url) => { if (!cancelled) setDataURL(url); })
      .finally(() => { if (!cancelled) setDone(true); });
    return () => { cancelled = true; };
  }, [orderId, valid]);

  if (!valid) {
    return (
      <div className="text-center">
        <div className="rounded-xl flex flex-col items-center justify-center gap-2 mx-auto" style={{ width: size, height: size, background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
          <Lock className="w-10 h-10 text-[var(--text-disabled)]" />
          <p className="text-xs text-[var(--text-disabled)]">QR expired</p>
        </div>
        <p className="mt-2 text-[10px] text-[var(--text-disabled)] font-mono break-all px-4">{qrCodeString}</p>
      </div>
    );
  }

  if (!done) {
    return (
      <div className="text-center">
        <div className="rounded-xl flex items-center justify-center" style={{ width: size, height: size, background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)", margin: "0 auto" }}>
          <div className="w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!dataURL) {
    return (
      <div className="text-center">
        <div className="rounded-xl flex flex-col items-center justify-center gap-2 mx-auto" style={{ width: size, height: size, background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
          <Lock className="w-10 h-10 text-[var(--text-disabled)]" />
          <p className="text-xs text-[var(--text-disabled)]">QR unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="p-2 rounded-xl inline-block" style={{ background: "#fff" }}>
        <img src={dataURL} alt="QR Pickup Pass" width={size} height={size} />
      </div>
      <p className="mt-2 text-[10px] text-[var(--text-disabled)] font-mono break-all px-4">{qrCodeString}</p>
    </div>
  );
}
