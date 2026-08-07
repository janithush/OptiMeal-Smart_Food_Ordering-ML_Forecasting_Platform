"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Coins, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface Batch {
  id: string;
  earned: number;
  redeemed: number;
  source: string;
  earnedAt: string;
  expiresAt: string;
}

interface Props {
  balance: number;
  batches: Batch[];
  expiringBatches: Batch[];
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
}

export default function RewardsPageContent({ balance, batches, expiringBatches }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push("/student/home")} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Rewards</h1>
        </div>

        {/* Coins Balance Card */}
        <div className="rounded-2xl p-6 mb-6 text-center" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-yellow-500/10 mb-3">
            <Coins className="w-7 h-7 text-yellow-400" />
          </div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Available Coins</p>
          <p className="text-4xl font-bold text-yellow-400">{balance}</p>
          <p className="text-xs text-[var(--text-disabled)] mt-2">1 Coin = LKR 1 discount at checkout</p>
        </div>

        {/* How to Earn */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Top-Up", coins: "1 Coin", per: "LKR 100", color: "green" },
            { label: "Pre-Order", coins: "2 Coins", per: "LKR 100", color: "brand" },
            { label: "Walk-In", coins: "0 Coins", per: "—", color: "amber" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl p-3 text-center" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <p className={`text-lg font-bold ${c.color === "green" ? "text-green-400" : c.color === "brand" ? "text-[var(--brand)]" : "text-amber-400"}`}>{c.coins}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{c.label}</p>
              <p className="text-[10px] text-[var(--text-disabled)]">per {c.per}</p>
            </div>
          ))}
        </div>

        {/* Expiring Soon Warning */}
        {expiringBatches.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">Coins Expiring Soon</p>
              <p className="text-xs text-amber-400/70 mt-1">You have coins expiring within 7 days. Use them before they expire!</p>
              <div className="mt-2 space-y-1">
                {expiringBatches.map((b) => (
                  <div key={b.id} className="flex justify-between text-xs text-amber-400/60">
                    <span>{b.earned - b.redeemed} Coins</span>
                    <span>Expires {formatDate(b.expiresAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Batches */}
        <div>
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">Coin Batches</h2>
          {batches.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-sm">No Coins yet — start by topping up or placing a pre-order!</div>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                    {b.source === "WALLET_TOP_UP" ? <TrendingDown className="w-4 h-4 text-green-400" /> : <TrendingUp className="w-4 h-4 text-[var(--brand)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{b.source === "WALLET_TOP_UP" ? "Top-Up Bonus" : "Pre-Order Bonus"}</p>
                    <p className="text-xs text-[var(--text-muted)]">Earned {formatDate(b.earnedAt)} &middot; Expires {formatDate(b.expiresAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-yellow-400">{b.earned - b.redeemed}</p>
                    <p className="text-[10px] text-[var(--text-disabled)]">{b.earned} earned &middot; {b.redeemed} used</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
