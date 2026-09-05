import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Lightweight API Route Handler auth verification (AD-4 layer 2).
 */

type AuthSession = Record<string, unknown> & {
  user: { id: string; name?: string | null; email?: string | null; role: string };
};

type AuthResult = { session: AuthSession; error: null };
type AuthError = { session: null; error: ReturnType<typeof NextResponse.json> };
type AuthOutcome = AuthResult | AuthError;

export function isAuthResult(outcome: AuthOutcome): outcome is AuthResult {
  return outcome.session !== null && outcome.error === null;
}

export async function verifyApiAuth(): Promise<AuthOutcome> {
  const session = await auth() as AuthSession | null;
  if (!session?.user?.id) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  // Fail-closed: instant deactivation — active DB check per request.
  // JWT alone is not trusted for isActive.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, role: true },
  });
  if (!dbUser || dbUser.isActive === false) {
    return { session: null, error: NextResponse.json({ error: "Account deactivated" }, { status: 403 }) };
  }
  // Overwrite JWT role with DB truth (fail-closed to STUDENT).
  session.user.role = dbUser.role === "ADMIN" ? "ADMIN" : "STUDENT";
  return { session, error: null };
}

export async function requireApiRole(role: string): Promise<AuthOutcome> {
  const outcome = await verifyApiAuth();
  if (outcome.error) return outcome;
  if (!isAuthResult(outcome)) return outcome;
  if (outcome.session.user.role !== role) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return outcome;
}
