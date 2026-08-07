import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import GroupOrderClient from "./GroupOrderClient";

export default async function GroupOrderPage() {
  const session = await requireAuth();
  if (session.user.role !== "STUDENT") redirect("/forbidden");

  return (
    <GroupOrderClient
      userId={session.user.id}
      userName={session.user.name ?? "Student"}
      userEmail={session.user.email ?? ""}
    />
  );
}
