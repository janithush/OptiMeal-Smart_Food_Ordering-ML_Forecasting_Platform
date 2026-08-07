import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import AdminMenuClient from "./AdminMenuClient";

export default async function AdminMenuPage() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") redirect("/forbidden");

  return <AdminMenuClient userName={session.user.name ?? "Admin"} />;
}
