import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import AdminDashboardClient from "./AdminDashboardClient";
import type { DashboardPayload } from "@/lib/order-events";

async function fetchInitialDashboard(): Promise<DashboardPayload> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Build the absolute base URL from the request's host header so this
  // works in dev, on Vercel, and behind a reverse proxy.
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/admin/dashboard`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      preOrderCount: 0,
      walkInCount: 0,
      itemsSold: [],
      hourlySales: [],
      slotQueueDepths: [],
      updatedAt: new Date().toISOString(),
    };
  }

  return res.json();
}

export default async function AdminDashboardPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const initialData = await fetchInitialDashboard();

  return (
    <AdminDashboardClient
      userName={session.user.name ?? "Admin"}
      initialData={initialData}
    />
  );
}
