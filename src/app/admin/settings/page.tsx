import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTodayDate } from "@/lib/inventory";
import AcademicCalendarClient from "./AcademicCalendarClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
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

  return (
    <AcademicCalendarClient
      userName={session.user?.name ?? "Admin"}
      initialEntries={initialEntries}
      currentSemesterPeriod={semesterEntry?.semesterPeriod ?? "REGULAR_LECTURES"}
    />
  );
}
