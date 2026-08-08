import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/academic-calendar — List all calendar entries
 * POST /api/admin/academic-calendar — Create a new date range entry
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const entries = await prisma.academicCalendar.findMany({
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      semesterPeriod: e.semesterPeriod,
      startDate: e.startDate.toISOString().split("T")[0],
      endDate: e.endDate.toISOString().split("T")[0],
      label: e.label,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const semesterPeriod = String(body.semesterPeriod ?? "").trim();
  const startDateStr = String(body.startDate ?? "").trim();
  const endDateStr = String(body.endDate ?? "").trim();
  const label = body.label ? String(body.label).trim() : null;

  const VALID_PERIODS = ["REGULAR_LECTURES", "PRE_EXAM_WEEK", "STUDY_LEAVE", "EXAM_PERIOD"];
  if (!VALID_PERIODS.includes(semesterPeriod)) {
    return NextResponse.json(
      { error: `semesterPeriod must be one of: ${VALID_PERIODS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    return NextResponse.json({ error: "startDate is required (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!endDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    return NextResponse.json({ error: "endDate is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const startDate = new Date(startDateStr + "T00:00:00Z");
  const endDate = new Date(endDateStr + "T00:00:00Z");

  if (endDate < startDate) {
    return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
  }

  const entry = await prisma.academicCalendar.create({
    data: {
      semesterPeriod,
      startDate,
      endDate,
      label: label || null,
    },
  });

  return NextResponse.json(
    {
      entry: {
        id: entry.id,
        semesterPeriod: entry.semesterPeriod,
        startDate: entry.startDate.toISOString().split("T")[0],
        endDate: entry.endDate.toISOString().split("T")[0],
        label: entry.label,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
