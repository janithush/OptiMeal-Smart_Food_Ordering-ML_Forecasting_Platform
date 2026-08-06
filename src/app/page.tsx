import { getServerSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

/**
 * Root page — redirects based on authentication and role.
 *
 * - Not authenticated → /login
 * - STUDENT → /student/home
 * - ADMIN → /admin/dashboard
 */
export default async function HomePage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  if (role === "ADMIN") {
    redirect("/admin/dashboard");
  }

  redirect("/student/home");
}
