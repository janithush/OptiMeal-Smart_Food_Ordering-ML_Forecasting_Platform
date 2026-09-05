"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { springSnappy, fadeEase, listContainer, listItem, HIT_SLOP } from "@/lib/motion";
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, RefreshCw, Plus, X, CheckCircle, AlertCircle } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  runningBalance: number;
  createdAt: string;
  orderId: string | null;
  payHereRef: string | null;
}

interface Props {
  balance: number;
  transactions: Transaction[];
}

const typeConfig: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
  TOP_UP: { label: "Top-Up", icon: TrendingDown, color: "rgb(74,222,128)" },
  ORDER_DEDUCTION: { label: "Order", icon: TrendingUp, color: "rgb(250,204,21)" },
  COINS_REDEMPTION: { label: "Coins", icon: RefreshCw, color: "oklch(0.78 0.18 55)" },
  REFUND: { label: "Refund", icon: TrendingDown, color: "rgb(96,165,250)" },
};

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-LK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function WalletPageContent({ balance, transactions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showTopUp, setShowTopUp] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  // Double-submit guard: one PayHere session per attempt. The key is also
  // sent to the server for cross-redirect traceability.
  const placingRef = useRef(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<{ type: "success" | "cancelled"; visible: boolean }>({ type: "cancelled", visible: false });

  // Handle return from PayHere
  useEffect(() => {
    const status = searchParams.get("topup");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- banner auto-dismiss
    if (status === "success") setBanner({ type: "success", visible: true });
    if (status === "cancelled") setBanner({ type: "cancelled", visible: true });
    const t = setTimeout(() => setBanner((b) => ({ ...b, visible: false })), 8000);
    return () => clearTimeout(t);
  }, [searchParams]);

  const handleTopUp = async () => {
    if (placingRef.current) return;
    setError("");
    const num = parseInt(amount, 10);
    if (!num || num < 100) { setError("Minimum top-up is LKR 100"); return; }
    if (num > 50000) { setError("Maximum top-up is LKR 50,000"); return; }

    placingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/student/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Fresh attempt key per top-up initiation.
        body: JSON.stringify({ amount: num, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); setLoading(false); placingRef.current = false; return; }

      // Auto-submit to PayHere via dynamically created form
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.actionUrl;
      Object.entries(data.fields as Record<string, string>).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch {
      setError("Network error — please try again");
      setLoading(false);
      placingRef.current = false;
    }
    // NOTE: placingRef stays set on success — the page redirects to PayHere.
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <motion.button
            onClick={() => router.push("/student/home")}
            whileTap={{ scale: 0.96 }}
            aria-label="Back to menu"
            className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`}
          >
            <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
          </motion.button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Wallet</h1>
        </div>

        {/* Return Banner */}
        <AnimatePresence>
          {banner.visible && (
            <motion.div
              key={`banner-${banner.type}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={fadeEase}
              className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-sm ${banner.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-amber-500/10 border border-amber-500/20 text-amber-400"}`}
            >
              {banner.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {banner.type === "success" ? "Payment received! Balance will update shortly." : "Top-up cancelled — no charges were made."}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ y: springSnappy, opacity: fadeEase }}
          className="rounded-2xl p-6 mb-8 text-center"
          style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--brand)]/10 mb-3">
            <Wallet className="w-6 h-6 text-[var(--brand)]" />
          </div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Your Balance</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={balance}
              initial={{ opacity: 0.4, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.4, scale: 0.96 }}
              transition={fadeEase}
              className="text-3xl font-bold text-[var(--brand)]"
            >
              Rs.{balance.toLocaleString()}
            </motion.p>
          </AnimatePresence>
          <motion.button
            onClick={() => setShowTopUp(true)}
            whileTap={{ scale: 0.96 }}
            className="mt-4 px-5 py-2 rounded-xl bg-[var(--brand)] text-black text-sm font-semibold hover:bg-[oklch(0.82_0.18_55)] transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Top Up
          </motion.button>
        </motion.div>

        {/* Top-Up Modal */}
        <AnimatePresence mode="wait">
          {showTopUp && (
            <motion.div
              key="topup-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeEase}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
              onClick={() => setShowTopUp(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.98 }}
                transition={{ y: springSnappy, scale: springSnappy, opacity: fadeEase }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl p-6"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Top Up Wallet</h2>
                  <motion.button
                    onClick={() => setShowTopUp(false)}
                    whileTap={{ scale: 0.96 }}
                    aria-label="Close top-up"
                    className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors ${HIT_SLOP}`}
                  >
                    <X className="w-4 h-4 text-[var(--text-muted)]" />
                  </motion.button>
                </div>

                {/* Quick Amount Chips */}
                <LayoutGroup id="topup-amounts">
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {QUICK_AMOUNTS.map((a) => {
                      const active = amount === String(a);
                      return (
                        <motion.button
                          key={a}
                          onClick={() => setAmount(String(a))}
                          whileTap={{ scale: 0.96 }}
                          aria-pressed={active}
                          className={`relative py-2 rounded-lg text-xs font-bold ${HIT_SLOP} ${
                            active ? "text-black" : "text-[var(--text-secondary)]"
                          }`}
                        >
                          {active ? (
                            <motion.span
                              layoutId="topup-amount-pill"
                              transition={springSnappy}
                              className="absolute inset-0 rounded-lg bg-[var(--brand)]"
                            />
                          ) : (
                            <span className="absolute inset-0 rounded-lg bg-white/5" />
                          )}
                          <span className="relative z-10">Rs.{a.toLocaleString()}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </LayoutGroup>

                {/* Custom Amount */}
                <div className="mb-4">
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Amount (LKR)</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                    <span className="text-[var(--text-muted)] text-sm">Rs.</span>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="100" className="bg-transparent flex-1 text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  </div>
                  {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
                </div>

                <p className="text-[10px] text-[var(--text-disabled)] mb-4">Minimum LKR 100 · Maximum LKR 50,000 · Secure payment via PayHere</p>
                <motion.button
                  onClick={handleTopUp}
                  disabled={loading || !amount}
                  whileTap={{ scale: 0.96 }}
                  className="w-full py-3 rounded-xl bg-[var(--brand)] text-black font-semibold text-sm hover:bg-[oklch(0.82_0.18_55)] disabled:opacity-30 transition-colors"
                >
                  {loading ? "Redirecting to PayHere..." : "Top Up via PayHere"}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transactions */}
        <div>
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--text-muted)] text-sm">No transactions yet — top up to get started!</p>
            </div>
          ) : (
            <motion.div variants={listContainer} initial="hidden" animate="shown" className="space-y-2">
              {transactions.map((tx) => {
                const cfg = typeConfig[tx.type] ?? { label: tx.type, icon: TrendingUp, color: "var(--text-muted)" };
                const Icon = cfg.icon;
                const isCredit = tx.amount > 0;
                return (
                  <motion.div key={tx.id} variants={listItem} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{cfg.label}</span>
                        {tx.orderId && <span className="text-[10px] text-[var(--text-disabled)]">{tx.orderId.slice(0, 12)}...</span>}
                        {tx.payHereRef && <span className="text-[10px] text-[var(--text-disabled)]">PayHere</span>}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                        {isCredit ? "+" : "−"}Rs.{Math.abs(tx.amount)}
                      </p>
                      <p className="text-[10px] text-[var(--text-disabled)]">Bal: Rs.{tx.runningBalance}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
