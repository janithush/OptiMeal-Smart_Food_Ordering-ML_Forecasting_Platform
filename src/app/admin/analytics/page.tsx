import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTodayDate } from "@/lib/date-utils";
import { ArrowLeft } from "lucide-react";
import WastageHeatmap from "@/components/admin/WastageHeatmap";
import DemandSegments from "@/components/admin/DemandSegments";
import ModelHealth from "@/components/admin/ModelHealth";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  var session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  var todayStr = getTodayDate().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[oklch(0.08_0.01_260)]/90 backdrop-blur-md border-b border-[rgba(255,255,255,0.07)] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="p-1">
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">Analytics</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Welcome, {session.user?.name ?? "Admin"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <WastageHeatmap />
        <DemandSegments />
        <ModelHealth />
      </div>
    </div>
  );
}
