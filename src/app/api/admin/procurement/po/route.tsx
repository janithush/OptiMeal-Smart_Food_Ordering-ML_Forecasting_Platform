import { requireApiRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getProcurementAlerts } from "@/lib/procurement";
import { PODocument } from "@/lib/po-document";
import { pdf } from "@react-pdf/renderer";

/**
 * GET /api/admin/procurement/po
 *
 * Generates and returns a PDF Purchase Order for all unresolved alerts today.
 * Response is a downloadable PDF file.
 */
export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const alerts = await getProcurementAlerts();

  if (alerts.length === 0) {
    return NextResponse.json(
      { error: "No unresolved procurement alerts to generate a PO for." },
      { status: 400 }
    );
  }

  const date = alerts[0].date;
  const blob = await pdf(
    <PODocument alerts={alerts} date={date} />
  ).toBlob();

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Purchase-Order-${date}.pdf"`,
    },
  });
}
