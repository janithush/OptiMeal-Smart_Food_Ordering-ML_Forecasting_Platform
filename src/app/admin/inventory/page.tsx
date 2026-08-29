import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import InventoryClient from "./InventoryClient";

async function fetchInitialInventory(): Promise<{
  date: string;
  ingredients: Array<{
    id: string;
    name: string;
    unit: string;
    openingStock: number | null;
    receivedStock: number | null;
    consumedStock: number | null;
    closingStock: number | null;
    wastage: number | null;
    forecastedNeed: number | null;
    hasForecast: boolean;
  }>;
}> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Build the absolute base URL from the request's host header so this
  // works in dev, on Vercel, and behind a reverse proxy without
  // requiring an env var to be set.
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/admin/inventory`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) {
    return { date: new Date().toISOString().split("T")[0], ingredients: [] };
  }

  return res.json();
}

export default async function AdminInventoryPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  const initialData = await fetchInitialInventory();

  return (
    <InventoryClient
      userName={session.user.name ?? "Admin"}
      initialData={initialData}
    />
  );
}
