"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

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

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-LK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function WalletPageContent({ balance, transactions }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push("/student/home")} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Wallet</h1>
        </div>

        {/* Balance Card */}
        <div className="rounded-2xl p-6 mb-8 text-center" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--brand)]/10 mb-3">
            <Wallet className="w-6 h-6 text-[var(--brand)]" />
          </div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Your Balance</p>
          <p className="text-3xl font-bold text-[var(--brand)]">Rs.{balance.toLocaleString()}</p>
          <button disabled className="mt-4 px-4 py-2 rounded-xl bg-white/5 text-[var(--text-disabled)] text-xs cursor-not-allowed">
            Top Up (Coming Soon)
          </button>
        </div>

        {/* Transactions */}
        <div>
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--text-muted)] text-sm">No transactions yet — top up to get started!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const cfg = typeConfig[tx.type] ?? { label: tx.type, icon: TrendingUp, color: "var(--text-muted)" };
                const Icon = cfg.icon;
                const isCredit = tx.amount > 0;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{cfg.label}</span>
                        {tx.orderId && <span className="text-[10px] text-[var(--text-disabled)]">{tx.orderId.slice(0, 12)}...</span>}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{formatDate(tx.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                        {isCredit ? "+" : "−"}Rs.{Math.abs(tx.amount)}
                      </p>
                      <p className="text-[10px] text-[var(--text-disabled)]">Bal: Rs.{tx.runningBalance}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
