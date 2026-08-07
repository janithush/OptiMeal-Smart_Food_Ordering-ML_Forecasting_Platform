"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, ArrowRight, Copy, Check, Loader2 } from "lucide-react";
import type { GroupOrderData } from "@/types/group-order";

interface Props {
  onCreated: (group: GroupOrderData) => void;
  onJoined: (group: GroupOrderData) => void;
}

export default function CreateJoinGroup({ onCreated, onJoined }: Props) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/group-orders", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group order");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const trimmed = code.toUpperCase().trim();
    if (trimmed.length !== 6) {
      setError("Code must be 6 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/group-orders/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to join");
      onJoined(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "choose") {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 px-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-2">
          <Users className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Group Order</h2>
        <p className="text-sm text-[var(--text-muted)] text-center max-w-xs">
          Order together with friends, pick up at the same slot, and one person pays.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setMode("create")}
            className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Plus className="w-4 h-4" />
            Create New Group
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setMode("join")}
            className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 text-purple-400 border border-purple-500/30 bg-purple-500/10"
          >
            <ArrowRight className="w-4 h-4" />
            Join with Code
          </motion.button>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 px-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-2">
          {loading ? <Loader2 className="w-8 h-8 text-purple-400 animate-spin" /> : <Plus className="w-8 h-8 text-purple-400" />}
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Create Group</h2>
        <p className="text-sm text-[var(--text-muted)] text-center">Share the code with up to 5 friends.</p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleCreate}
          disabled={loading}
          className="w-full max-w-xs py-3 rounded-xl font-medium text-sm bg-purple-500 text-white disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Group Order"}
        </motion.button>
        <button onClick={() => setMode("choose")} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          ← Back
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // mode === "join"
  return (
    <div className="flex flex-col items-center gap-4 pt-12 px-4">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-2">
        <ArrowRight className="w-8 h-8 text-purple-400" />
      </div>
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Join Group</h2>
      <p className="text-sm text-[var(--text-muted)] text-center">Enter the 6-character code shared by your friend.</p>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="e.g. ABC123"
        maxLength={6}
        className="w-full max-w-xs px-4 py-3 rounded-xl text-center text-lg font-mono tracking-widest bg-white/5 border border-white/10 text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-purple-500/50"
      />
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleJoin}
        disabled={loading || code.length !== 6}
        className="w-full max-w-xs py-3 rounded-xl font-medium text-sm bg-purple-500 text-white disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join Group"}
      </motion.button>
      <button onClick={() => setMode("choose")} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
        ← Back
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
