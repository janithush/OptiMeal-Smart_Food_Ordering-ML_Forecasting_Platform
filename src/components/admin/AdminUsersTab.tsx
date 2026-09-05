"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  UserPlus,
  X,
  Shield,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import InviteAdminModal from "./InviteAdminModal";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface AdminRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "STUDENT" | "ADMIN";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  invitedByName: string | null;
  isSelf: boolean;
}

interface Invitation {
  id: string;
  email: string;
  token: string;
  invitedByName: string;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface AuditLog {
  id: string;
  actorName: string;
  actorEmail: string;
  targetName: string | null;
  action: string;
  ipAddress: string | null;
  createdAt: string;
}

export default function AdminUsersTab() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "demote" | "deactivate" | "cancel-invitation";
    target: AdminRow | Invitation;
  } | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAdminCount, setActiveAdminCount] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, invRes, auditRes] = await Promise.all([
        fetch("/api/admin/admins"),
        fetch("/api/admin/admins/invitations?status=all"),
        fetch("/api/admin/audit-log?limit=30"),
      ]);
      if (adminsRes.ok) {
        const json = await adminsRes.json();
        setAdmins(json.admins);
        setActiveAdminCount(json.admins.filter((a: AdminRow) => a.isActive).length);
      }
      if (invRes.ok) {
        const json = await invRes.json();
        setInvitations(json.invitations);
      }
      if (auditRes.ok) {
        const json = await auditRes.json();
        setAuditLogs(json.logs);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    let socket: ReturnType<typeof import("socket.io-client").io> | null = null;
    let cancelled = false;
    const connect = async () => {
      const { io } = await import("socket.io-client");
      if (cancelled) return;
      socket = io("/admin", { path: "/socket.io", withCredentials: true, transports: ["websocket", "polling"] });
      const refresh = () => void fetchAll();
      socket.on("adminUserAdded", refresh);
      socket.on("adminUserRemoved", refresh);
      socket.on("adminUserUpdated", refresh);
      socket.on("invitationsChanged", refresh);
      socket.on("systemSettingsChanged", refresh);
    };
    void connect();
    return () => { cancelled = true; socket?.disconnect(); };
  }, [fetchAll]);

  async function executeConfirmedAction() {
    if (!confirmAction) return;
    setError(null);
    try {
      let url = "";
      let method = "";
      if (confirmAction.type === "demote") {
        url = `/api/admin/admins/${confirmAction.target.id}`;
        method = "PATCH";
      } else if (confirmAction.type === "deactivate") {
        url = `/api/admin/admins/${confirmAction.target.id}`;
        method = "DELETE";
      } else if (confirmAction.type === "cancel-invitation") {
        url = `/api/admin/admins/invitations/${confirmAction.target.id}`;
        method = "DELETE";
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PATCH" ? JSON.stringify({ action: "demote" }) : undefined,
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Action failed"); return; }
      setConfirmAction(null);
      void fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  async function handleReactivate(admin: AdminRow) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed to reactivate");
      else void fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  function statusOf(inv: Invitation): "pending" | "accepted" | "cancelled" | "expired" {
    if (inv.acceptedAt) return "accepted";
    if (inv.cancelledAt) return "cancelled";
    // eslint-disable-next-line react-hooks/purity
    if (new Date(inv.expiresAt).getTime() < Date.now()) return "expired";
    return "pending";
  }

  const pendingInvitations = invitations.filter((i) => statusOf(i) === "pending");
  const pastInvitations = invitations.filter((i) => statusOf(i) !== "pending");

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Admins</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {activeAdminCount} active · {admins.length - activeAdminCount} deactivated
            </p>
          </div>
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand)] hover:opacity-90 text-black transition-colors">
            <UserPlus className="w-3.5 h-3.5" />
            Invite admin
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" /></div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.07)]" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.07)]">
                  <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Name</th>
                  <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Email</th>
                  <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Invited by</th>
                  <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Last login</th>
                  <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                  <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-[rgba(255,255,255,0.06)] hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {a.image && <img src={a.image} alt="" className="w-6 h-6 rounded-full" />}
                        <span className="text-[var(--text-primary)] font-medium">{a.name}{a.isSelf && <span className="ml-1 text-[10px] text-[var(--brand)]">(you)</span>}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">{a.email}</td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{a.invitedByName ?? <span className="italic">founder</span>}</td>
                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : <span className="italic">never</span>}</td>
                    <td className="py-2.5 px-3">
                      {a.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Shield className="w-2.5 h-2.5" />Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[var(--text-muted)] border border-[rgba(255,255,255,0.08)]">Deactivated</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {a.isSelf ? (
                        <span className="text-[10px] text-[var(--text-disabled)] italic">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {a.isActive ? (
                            <>
                              <button onClick={() => setConfirmAction({ type: "demote", target: a })} disabled={activeAdminCount <= 1} title={activeAdminCount <= 1 ? "Cannot demote the last active admin" : "Demote to STUDENT"} className="px-2 py-1 rounded text-[10px] font-medium bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Demote</button>
                              <button onClick={() => setConfirmAction({ type: "deactivate", target: a })} disabled={activeAdminCount <= 1} title={activeAdminCount <= 1 ? "Cannot deactivate the last active admin" : "Deactivate"} className="p-1 text-[var(--text-muted)] hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-3 h-3" /></button>
                            </>
                          ) : (
                            <button onClick={() => handleReactivate(a)} className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors flex items-center gap-1"><RotateCcw className="w-2.5 h-2.5" />Reactivate</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Pending invitations
          {pendingInvitations.length > 0 && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{pendingInvitations.length}</span>
          )}
        </h3>
        {pendingInvitations.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic">No pending invitations.</p>
        ) : (
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <PendingInvitationCard key={inv.id} invitation={inv} onCancel={() => setConfirmAction({ type: "cancel-invitation", target: inv })} />
            ))}
          </div>
        )}
      </section>
      {pastInvitations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Invitation history</h3>
          <div className="space-y-1">
            {pastInvitations.slice(0, 20).map((inv) => {
              const status = statusOf(inv);
              return (
                <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: "var(--glass-bg)" }}>
                  <div className="flex items-center gap-3">
                    <span className={status === "accepted" ? "text-emerald-400" : status === "cancelled" ? "text-red-400" : "text-amber-400"}>{status === "accepted" ? "\u2713" : status === "cancelled" ? "\u2715" : "\u23f1"}</span>
                    <span className="text-[var(--text-primary)]">{inv.email}</span>
                    <span className="text-[var(--text-muted)]">\u00b7 by {inv.invitedByName}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">{new Date(inv.createdAt).toLocaleDateString()} \u00b7 <span className="capitalize">{status}</span></span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <button onClick={() => setShowAudit(!showAudit)} className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors">
          {showAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Activity log ({auditLogs.length})
        </button>
        {showAudit && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic">No activity yet.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 px-3 py-2 rounded text-xs" style={{ background: "var(--glass-bg)" }}>
                  <span className="font-mono text-[10px] text-[var(--text-disabled)] flex-shrink-0 w-32">{new Date(log.createdAt).toLocaleString()}</span>
                  <span className="font-medium text-[var(--text-primary)]">{log.actorName}</span>
                  <span className="text-[var(--text-secondary)]">{actionLabel(log.action)}</span>
                  {log.targetName && <span className="text-[var(--text-secondary)]">{log.targetName}</span>}
                  {log.ipAddress && <span className="text-[10px] text-[var(--text-muted)] ml-auto">{log.ipAddress}</span>}
                </div>
              ))
            )}
          </motion.div>
        )}
      </section>

      <InviteAdminModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={fetchAll} />

      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmActionTitle(confirmAction)}
        message={confirmActionMessage(confirmAction, activeAdminCount)}
        confirmLabel="Confirm"
        variant="danger"
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function PendingInvitationCard({ invitation, onCancel }: { invitation: Invitation; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${baseUrl}/admin/invite/${invitation.token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  // eslint-disable-next-line react-hooks/purity
  const expiresIn = new Date(invitation.expiresAt).getTime() - Date.now();
  const days = Math.floor(expiresIn / (24 * 60 * 60 * 1000));

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.07)] p-3" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-medium text-[var(--text-primary)]">{invitation.email}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Invited by {invitation.invitedByName} \u00b7 expires in {days > 0 ? `${days}d` : "today"}</p>
        </div>
        <button onClick={onCancel} className="p-1 text-[var(--text-muted)] hover:text-red-400"><X className="w-3 h-3" /></button>
      </div>
      <div className="flex gap-2">
        <input readOnly value={inviteUrl} onClick={(e) => e.currentTarget.select()} className="flex-1 px-2 py-1 rounded text-[10px] font-mono bg-[oklch(0.18_0.012_260)] border border-[rgba(255,255,255,0.08)] text-[var(--text-primary)]" />
        <button onClick={copy} className="px-2 py-1 rounded text-[10px] font-bold bg-[var(--brand)] hover:opacity-90 text-black">{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    INVITE_CREATED: "created invitation for",
    INVITE_ACCEPTED: "accepted invitation as admin",
    INVITE_CANCELLED: "cancelled invitation for",
    ADMIN_PROMOTED: "promoted",
    ADMIN_DEMOTED: "demoted",
    ADMIN_DEACTIVATED: "deactivated",
    ADMIN_REACTIVATED: "reactivated",
    SETTINGS_UPDATED: "updated system settings",
  };
  return labels[action] ?? action;
}

function confirmActionTitle(action: { type: string; target: { name?: string; email?: string } } | null): string {
  if (!action) return "";
  const t = action.target as { name?: string; email?: string };
  const name = t.name ?? t.email ?? "this admin";
  if (action.type === "demote") return `Demote ${name}?`;
  if (action.type === "deactivate") return `Deactivate ${name}?`;
  if (action.type === "cancel-invitation") return `Cancel invitation?`;
  return "Confirm action";
}

function confirmActionMessage(action: { type: string; target: { name?: string; email?: string } } | null, activeCount: number): string {
  if (!action) return "";
  if (action.type === "demote") {
    if (activeCount <= 1) return "This is the last active admin \u2014 you cannot demote them.";
    return "This admin will be demoted back to a STUDENT account. They can be re-promoted later.";
  }
  if (action.type === "deactivate") {
    if (activeCount <= 1) return "This is the last active admin \u2014 you cannot deactivate them.";
    return "This admin will be deactivated (soft-deleted). They will lose access immediately. You can reactivate them later.";
  }
  if (action.type === "cancel-invitation") {
    return "This invitation link will be invalidated. The invitee will no longer be able to use it.";
  }
  return "";
}
