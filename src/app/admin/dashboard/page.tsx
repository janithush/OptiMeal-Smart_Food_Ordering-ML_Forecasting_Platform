import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] flex items-center justify-center">
      <div
        className="rounded-2xl p-10 max-w-md w-full text-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1 className="text-2xl font-bold text-[oklch(0.97_0_0)]">
          Admin Dashboard
        </h1>
        <p className="mt-3 text-[oklch(0.78_0.18_55)] text-sm">
          Welcome, {session.user.name ?? "Admin"}
        </p>
        <p className="mt-3 text-[oklch(0.65_0.01_260)] text-sm">
          Live sales KPIs, order queue, menu management — coming in Epic 6.
        </p>
      </div>
    </div>
  );
}
