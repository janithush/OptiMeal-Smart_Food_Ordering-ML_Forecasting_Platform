import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function StudentHomePage() {
  const session = await requireAuth();

  if (session.user.role !== "STUDENT") {
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
          Welcome, {session.user.name ?? "Student"}!
        </h1>
        <p className="mt-3 text-[oklch(0.65_0.01_260)] text-sm">
          Student Dashboard — coming soon in Epic 3.
        </p>
        <p className="mt-1 text-[oklch(0.55_0.01_260)] text-xs">
          Menu browsing, pre-order, wallet, and more.
        </p>
      </div>
    </div>
  );
}
