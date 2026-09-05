import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toCsv, csvFilename } from "@/lib/csv";

const exportQuerySchema = z
  .object({
    // Optional day filter (defaults to today, Colombo day computed server-side).
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
      .optional(),
    status: z
      .enum(["CONFIRMED", "IN_PREPARATION", "READY", "COLLECTED", "CANCELLED"])
      .optional(),
  })
  .strict();

/**
 * GET /api/admin/orders/export?date=YYYY-MM-DD&status=READY
 * Admin-only CSV export of orders (one row per order line).
 * Sanitised against spreadsheet formula injection + UTF-8 BOM for Sinhala text.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = exportQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const day = parsed.data.date ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T23:59:59.999Z`);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    include: {
      student: { select: { name: true, email: true, regNo: true } },
      items: { include: { menuItem: { select: { name: true } } } },
      pickupSlot: { select: { slotTime: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });

  const headers = [
    "Order Number",
    "Date",
    "Student Name",
    "Reg No",
    "Email",
    "Type",
    "Status",
    "Pickup Slot",
    "Item",
    "Quantity",
    "Unit Price (LKR)",
    "Subtotal (LKR)",
    "Order Total (LKR)",
  ];

  const rows: unknown[][] = [];
  for (const o of orders) {
    for (const it of o.items) {
      rows.push([
        o.orderNumber,
        o.createdAt.toISOString(),
        o.student.name,
        o.student.regNo ?? "",
        o.student.email,
        o.type,
        o.status,
        o.pickupSlot?.slotTime ?? "",
        it.menuItem.name,
        it.quantity,
        Number(it.unitPrice).toFixed(2),
        Number(it.subtotal).toFixed(2),
        Number(o.totalAmount).toFixed(2),
      ]);
    }
  }

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("cafesmart-orders")}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
