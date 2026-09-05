"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, AlertCircle, Loader2, Shield } from "lucide-react";

interface Props {
  token: string;
  userEmail: string;
  userName: string;
}

interface InvitationDetails {
  email: string;
  invitedByName: string;
  expiresAt: string;
}

type Status =
  | { kind: "loading" }
  | { kind: "validating-failed"; message: string }
  | { kind: "email-mismatch"; inviteeEmail: string; signedInEmail: string }
  | { kind: "ready"; invitation: InvitationDetails }
  | { kind: "accepting" }
  | { kind: "accepted" }
  | { kind: "error"; message: string };

export default function InviteAcceptClient({
  token,
  userEmail,
  userName,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/admin/invite/${token}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setStatus({
          kind: "validating-failed",
          message: json.error ?? "Invalid invitation link",
        });
        return;
      }
      const json = await res.json();
      if (json.invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
        setStatus({
          kind: "email-mismatch",
          inviteeEmail: json.invitation.email,
          signedInEmail: userEmail,
        });
        return;
      }
      setStatus({ kind: "ready", invitation: json.invitation });
    })();
  }, [token, userEmail]);

  async function accept() {
    setStatus({ kind: "accepting" });
    try {
      const res = await fetch(`/api/admin/invite/${token}/accept`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: json.error ?? "Failed to accept invitation" });
        return;
      }
      setStatus({ kind: "accepted" });
      setTimeout(() => {
        router.push("/admin/dashboard");
        router.refresh();
      }, 1500);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {status.kind === "loading" && (<div className="flex flex-col items-center text-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /><p className="mt-4 text-sm text-[var(--text-muted)]">Validating invitation...</p></div>)}
        {status.kind === "validating-failed" && (<div className="flex flex-col items-center text-center"><div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4"><AlertCircle className="w-6 h-6 text-red-400" /></div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Invalid invitation</h2><p className="text-sm text-[var(--text-muted)] mb-6">{status.message}</p><button onClick={() => router.push("/")} className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-[var(--text-primary)]">Go home</button></div>)}
        {status.kind === "email-mismatch" && (<div className="flex flex-col items-center text-center"><div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4"><AlertCircle className="w-6 h-6 text-amber-400" /></div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Email mismatch</h2><p className="text-sm text-[var(--text-muted)] mb-2">This invitation was for <strong className="text-[var(--text-primary)]">{status.inviteeEmail}</strong>, but you are signed in as <strong className="text-[var(--text-primary)]">{status.signedInEmail}</strong>.</p><p className="text-xs text-[var(--text-muted)] mb-6">Sign out and sign in with the invited email to accept.</p><Link href="/api/auth/signout" className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-[var(--text-primary)]">Sign out</Link></div>)}
        {status.kind === "ready" && (<div className="flex flex-col items-center text-center"><div className="w-12 h-12 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mb-4"><Shield className="w-6 h-6 text-[var(--brand)]" /></div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Admin invitation</h2><p className="text-sm text-[var(--text-muted)] mb-1"><strong className="text-[var(--text-primary)]">{status.invitation.invitedByName}</strong> has invited you to become an admin of this canteen.</p><p className="text-xs text-[var(--text-muted)] mb-6">You will be able to manage the menu, inventory, orders, and other admins.</p><button onClick={accept} className="w-full py-2.5 rounded-xl text-sm font-bold bg-[var(--brand)] hover:opacity-90 text-black">Accept invitation</button></div>)}
        {status.kind === "accepting" && (<div className="flex flex-col items-center text-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand)]" /><p className="mt-4 text-sm text-[var(--text-muted)]">Promoting you to admin...</p></div>)}
        {status.kind === "accepted" && (<div className="flex flex-col items-center text-center"><div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"><Check className="w-6 h-6 text-emerald-400" /></div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Welcome aboard!</h2><p className="text-sm text-[var(--text-muted)]">You are now an admin. Redirecting...</p></div>)}
        {status.kind === "error" && (<div className="flex flex-col items-center text-center"><div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4"><AlertCircle className="w-6 h-6 text-red-400" /></div><h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Something went wrong</h2><p className="text-sm text-[var(--text-muted)] mb-6">{status.message}</p><button onClick={() => setStatus({ kind: "loading" })} className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-[var(--text-primary)]">Try again</button></div>)}
        <p className="text-[10px] text-[var(--text-disabled)] mt-6 text-center">Signed in as {userName} ({userEmail})</p>
      </motion.div>
    </div>
  );
}
