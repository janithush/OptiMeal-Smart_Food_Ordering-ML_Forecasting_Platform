"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[oklch(0.55_0.01_260)] text-xs hover:text-[oklch(0.97_0_0)] hover:bg-[oklch(0.15_0.01_260)] transition-colors"
    >
      <LogOut className="w-4 h-4" /> Sign Out
    </button>
  );
}
