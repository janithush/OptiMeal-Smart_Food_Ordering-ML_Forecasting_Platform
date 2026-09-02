import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTodayDate } from "@/lib/inventory";
import { countPendingInvitations } from "@/lib/admin-management";
import SettingsLayoutClient from "./SettingsLayoutClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  // Fetch calendar entries for initial render
  const entries = await prisma.academicCalendar.findMany({
    orderBy: { startDate: "asc" },
  });

  const today = getTodayDate();
  const semesterEntry = await prisma.academicCalendar.findFirst({
    where: { startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { startDate: "desc" },
  });

  const initialEntries = entries.map((e) => ({
    id: e.id,
    semesterPeriod: e.semesterPeriod,
    startDate: e.startDate.toISOString().split("T")[0],
    endDate: e.endDate.toISOString().split("T")[0],
    label: e.label ?? "",
  }));

  const params = await searchParams;
  const validTabs = ["admins", "system", "calendar"] as const;
  const tab = (validTabs as readonly string[]).includes(params.tab ?? "")
    ? (params.tab as "admins" | "system" | "calendar")
    : "admins";

  const pendingInvitations = await countPendingInvitations();

  return (
    <SettingsLayoutClient
      userName={session.user?.name ?? "Admin"}
      initialCalendarEntries={initialEntries}
      currentSemesterPeriod={semesterEntry?.semesterPeriod ?? "REGULAR_LECTURES"}
      initialActiveTab={tab}
      pendingInvitations={pendingInvitations}
    />
  );
}
