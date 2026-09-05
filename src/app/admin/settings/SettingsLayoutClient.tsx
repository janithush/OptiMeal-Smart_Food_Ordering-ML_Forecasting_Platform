"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, LayoutGroup } from "motion/react";
import { ArrowLeft, Users, Settings as SettingsIcon, Calendar } from "lucide-react";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import SystemSettingsTab from "@/components/admin/SystemSettingsTab";
import AcademicCalendarTab from "./AcademicCalendarTab";
import { springSnappy, fadeEase, HIT_SLOP } from "@/lib/motion";

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
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="sticky top-0 z-10 bg-[var(--bg-base)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.button
                onClick={() => router.push("/admin/dashboard")}
                whileTap={{ scale: 0.96 }}
                aria-label="Back to dashboard"
                className={`p-1 text-[var(--text-secondary)] ${HIT_SLOP}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Settings</h1>
                <p className="text-xs text-[var(--text-muted)]">Welcome, {userName}</p>
              </div>
            </div>
          </div>

          <LayoutGroup id="settings-tabs">
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                const showBadge = tab.key === "admins" && pendingInvitations > 0;
                return (
                  <motion.button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    whileTap={{ scale: 0.96 }}
                    aria-pressed={active}
                    className={`relative flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                      active ? "text-black" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="settings-tab-pill"
                        transition={springSnappy}
                        className="absolute inset-0 rounded-lg bg-[var(--brand)]"
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">{pendingInvitations}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ y: springSnappy, opacity: fadeEase }}
        >
          {activeTab === "admins" && <AdminUsersTab />}
          {activeTab === "system" && <SystemSettingsTab />}
          {activeTab === "calendar" && <AcademicCalendarTab userName={userName} initialEntries={initialCalendarEntries} currentSemesterPeriod={currentSemesterPeriod} />}
        </motion.div>
      </div>
    </div>
  );
}
