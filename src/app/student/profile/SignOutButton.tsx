"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[var(--text-muted)] text-xs hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
    >
      <LogOut className="w-4 h-4" /> Sign Out
    </button>
  );
}
