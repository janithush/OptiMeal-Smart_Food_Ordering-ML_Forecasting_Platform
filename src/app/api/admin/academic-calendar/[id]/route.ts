import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/admin/academic-calendar/[id] — Update an entry
 * DELETE /api/admin/academic-calendar/[id] — Delete an entry
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const existing = await prisma.academicCalendar.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Academic calendar entry not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.semesterPeriod !== undefined) {
    const VALID_PERIODS = ["REGULAR_LECTURES", "PRE_EXAM_WEEK", "STUDY_LEAVE", "EXAM_PERIOD"];
    if (!VALID_PERIODS.includes(String(body.semesterPeriod).trim())) {
      return NextResponse.json(
        { error: `semesterPeriod must be one of: ${VALID_PERIODS.join(", ")}` },
        { status: 400 }
      );
    }
    updateData.semesterPeriod = String(body.semesterPeriod).trim();
  }

  if (body.startDate !== undefined) {
    updateData.startDate = new Date(String(body.startDate).trim() + "T00:00:00Z");
  }

  if (body.endDate !== undefined) {
    updateData.endDate = new Date(String(body.endDate).trim() + "T00:00:00Z");
  }

  if (body.label !== undefined) {
    updateData.label = body.label ? String(body.label).trim() : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.academicCalendar.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    entry: {
      id: updated.id,
      semesterPeriod: updated.semesterPeriod,
      startDate: updated.startDate.toISOString().split("T")[0],
      endDate: updated.endDate.toISOString().split("T")[0],
      label: updated.label,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const { id } = await params;

  const existing = await prisma.academicCalendar.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Academic calendar entry not found" }, { status: 404 });
  }

  await prisma.academicCalendar.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
