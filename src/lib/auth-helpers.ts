import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Returns the server-side session. Works in:
 * - Server Components
 * - Route Handlers (API routes)
 * - Server Actions
 */
export async function getServerSession() {
  return await auth();
}

/**
 * Requires an authenticated session. Use in API routes and
 * protected pages. Redirects to /login if no session exists.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Requires a specific role. Redirects to /login if not authenticated
 * or returns null for forbidden (caller handles 403).
 */
export async function requireRole(role: "STUDENT" | "ADMIN") {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== role) {
    return null;
  }
  return session;
}
