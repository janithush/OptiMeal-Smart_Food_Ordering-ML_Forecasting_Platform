import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import AdminOrdersClient from "./AdminOrdersClient";

export default async function AdminOrdersPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/forbidden");
  }

  return (
    <AdminOrdersClient userName={session.user.name ?? "Admin"} />
  );
}
