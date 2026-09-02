"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Copy, Check, Loader2, AlertCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

interface CreatedInvitation {
  email: string;
  invitedByName: string;
  expiresAt: string;
  inviteUrl: string;
}

export default function InviteAdminModal({ isOpen, onClose, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setEmail("");
    setError(null);
    setCreated(null);
    setCopied(false);
    setSubmitting(false);
  }

  function close() { reset(); onClose(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/admins/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create invitation"); return; }
      setCreated({
        email: json.invitation.email,
        invitedByName: json.invitation.invitedByName,
        expiresAt: json.invitation.expiresAt,
        inviteUrl: json.invitation.inviteUrl,
      });
      onInvited?.();
    } catch (err) { setError(err instanceof Error ? err.message : "Network error"); }
    finally { setSubmitting(false); }
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={close}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-6" style={{ background: "oklch(0.14 0.012 260)", border: "1px solid var(--glass-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[var(--text-primary)]">{created ? "Invitation created" : "Invite a new admin"}</h3>
              <button onClick={close} className="p-1 rounded hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            {!created ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-xs text-[var(--text-muted)]">Enter the Google email of the person you want to invite as admin. They&apos;ll receive a one-time-use link valid for 7 days. Share it with them via WhatsApp or in person.</p>
                <label className="block">
                  <span className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Google email</span>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="newadmin@gmail.com" autoFocus className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[oklch(0.18_0.012_260)] border border-[rgba(255,255,255,0.08)] text-[var(--text-primary)] placeholder-[var(--text-disabled)] text-sm focus:outline-none focus:border-[var(--brand)]" />
                  </div>
                </label>
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={close} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting || !email} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[var(--brand)] hover:opacity-90 text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Create invitation
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Invitation created for <strong>{created.email}</strong>. Share it — they must sign in with Google using that same email to be promoted to admin.</div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Invitation link</label>
                  <div className="flex gap-2">
                    <input readOnly value={created.inviteUrl} onClick={(e) => e.currentTarget.select()} className="flex-1 px-3 py-2 rounded-lg bg-[oklch(0.18_0.012_260)] border border-[rgba(255,255,255,0.08)] text-[var(--text-primary)] text-xs font-mono" />
                    <button onClick={handleCopy} className="px-3 py-2 rounded-lg bg-[var(--brand)] hover:opacity-90 text-black text-xs font-bold flex items-center gap-1.5 transition-colors">
                      {copied ? (<><Check className="w-3.5 h-3.5" />Copied</>) : (<><Copy className="w-3.5 h-3.5" />Copy</>)}
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-disabled)] mt-1.5">Expires {new Date(created.expiresAt).toLocaleString()}. Single-use only.</p>
                </div>
                <button onClick={close} className="w-full py-2.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 text-[var(--text-primary)] transition-colors">Done</button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
