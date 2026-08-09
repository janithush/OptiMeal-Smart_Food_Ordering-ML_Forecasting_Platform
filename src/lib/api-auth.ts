import { auth } from "@/lib/auth";
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
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
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
