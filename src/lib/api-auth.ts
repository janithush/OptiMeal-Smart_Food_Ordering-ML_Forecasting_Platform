import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Lightweight API Route Handler auth verification (AD-4 layer 2).
 *
 * Unlike middleware (which runs at Edge and can't access Prisma),
 * this runs in the Node.js runtime and can verify the session
 * against the database if needed.
 */

type AuthResult = {
  session: NonNullable<Awaited<ReturnType<typeof auth>>>;
  error: null;
};

type AuthError = {
  session: null;
  error: ReturnType<typeof NextResponse.json>;
};

type AuthOutcome = AuthResult | AuthError;

/**
 * Verify the session in an API Route Handler.
 *
 * Usage:
 *   const { session, error } = await verifyApiAuth();
 *   if (error) return error;
 *   // session.user is guaranteed non-null
 */
export async function verifyApiAuth(): Promise<AuthOutcome> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null } as AuthResult;
}

/**
 * Verify a specific role for an API Route Handler.
 *
 * Usage:
 *   const result = await requireApiRole("ADMIN");
 *   if (result.error) return result.error;
 *   // result.session.user.role === "ADMIN"
 */
export async function requireApiRole(
  role: "STUDENT" | "ADMIN"
): Promise<AuthOutcome> {
  const result = await verifyApiAuth();
  if (result.error) return result;
  if (result.session.user.role !== role) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}
