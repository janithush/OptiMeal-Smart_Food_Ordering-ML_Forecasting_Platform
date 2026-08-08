import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import InventoryClient from "./InventoryClient";

async function fetchInitialInventory(): Promise<{
  date: string;
  ingredients: Array<{
    id: string;
    name: string;
    unit: string;
    openingStock: number | null;
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

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
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
