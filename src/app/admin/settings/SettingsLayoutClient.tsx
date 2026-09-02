"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Settings as SettingsIcon, Calendar } from "lucide-react";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import SystemSettingsTab from "@/components/admin/SystemSettingsTab";
import AcademicCalendarTab from "./AcademicCalendarTab";

type TabKey = "admins" | "system" | "calendar";

interface Props {
  userName: string;
  initialCalendarEntries: Array<{
    id: string;
    semesterPeriod: string;
    startDate: string;
    endDate: string;
    label: string;
  }>;
  currentSemesterPeriod: string;
  initialActiveTab?: TabKey;
  pendingInvitations?: number;
}

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "admins", label: "Admin Users", icon: Users },
  { key: "system", label: "System", icon: SettingsIcon },
  { key: "calendar", label: "Academic Calendar", icon: Calendar },
];

export default function SettingsLayoutClient({
  userName,
  initialCalendarEntries,
  currentSemesterPeriod,
  initialActiveTab = "admins",
  pendingInvitations = 0,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>(initialActiveTab);

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/admin/dashboard")} className="p-1"><ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" /></button>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Settings</h1>
                <p className="text-xs text-[var(--text-muted)]">Welcome, {userName}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              const showBadge = tab.key === "admins" && pendingInvitations > 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative ${active ? "bg-[var(--brand)] text-black" : "text-[var(--text-secondary)] hover:bg-white/5"}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">{pendingInvitations}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "admins" && <AdminUsersTab />}
          {activeTab === "system" && <SystemSettingsTab />}
          {activeTab === "calendar" && <AcademicCalendarTab userName={userName} initialEntries={initialCalendarEntries} currentSemesterPeriod={currentSemesterPeriod} />}
        </motion.div>
      </div>
    </div>
  );
}
