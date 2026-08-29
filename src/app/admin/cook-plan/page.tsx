import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import CookPlanClient from "./CookPlanClient";
import { getTodayDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

async function fetchInitialCookPlan(): Promise<{
  date: string;
  isLocked: boolean;
  allConfirmed: boolean;
  items: Array<{
    id: string;
    menuItemId: string;
    menuItemName: string;
    forecastQty: number;
    preOrderQty: number;
    finalQty: number;
    bufferQty: number;
    adminAdjusted: boolean;
    status: string;
    confidenceScore: number | null;
    modelVersion: string | null;
  }>;
}> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => c.name + "=" + c.value)
    .join("; ");

  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  const today = getTodayDate().toISOString().split("T")[0];
  const res = await fetch(baseUrl + "/api/admin/cook-plan?date=" + today, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    return { date: today, isLocked: false, allConfirmed: false, items: [] };
  }

  return res.json();
}

export default async function AdminCookPlanPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const initialData = await fetchInitialCookPlan();

  return (
    <CookPlanClient
      userName={session.user?.name ?? "Admin"}
      initialData={initialData}
    />
  );
}
