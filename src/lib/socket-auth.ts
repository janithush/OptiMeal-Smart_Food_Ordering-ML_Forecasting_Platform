/**
 * Socket.io session extraction utilities.
 *
 * Auth.js v5 encrypts JWT sessions as JWE (JSON Web Encryption) using
 * `alg: "dir"` and `enc: "A256CBC-HS512"`. The encryption key is derived
 * from AUTH_SECRET via HKDF-SHA256 with a salt-dependent info string.
 *
 * We use `@auth/core/jwt`'s `decode()` (re-exported by `next-auth/jwt`)
 * which handles the full JWE → JWT → claims pipeline internally.
 *
 * The salt value affects HKDF key derivation. Auth.js may encode with a
 * specific salt (or undefined), so we retry with multiple salts to handle
 * version differences.
 *
 * Cookie names vary by environment:
 *   - Dev (http://localhost)   → authjs.session-token
 *   - Prod (https://)          → __Secure-authjs.session-token
 */

export interface SocketSession {
  userId: string;
  role: "STUDENT" | "ADMIN";
}

// ─── Cookie Parsing ───────────────────────────────────────────────

function extractSessionToken(cookieHeader: string): string | null {
  if (!cookieHeader) return null;

  function getCookie(name: string): string | null {
    const regex = new RegExp(
      `(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`
    );
    const match = cookieHeader.match(regex);
    return match ? decodeURIComponent(match[1]) : null;
  }

  return (
    getCookie("authjs.session-token") ??
    getCookie("__Secure-authjs.session-token") ??
    getCookie("next-auth.session-token") ??
    getCookie("__Secure-next-auth.session-token")
  );
}

// ─── Session Decoding ─────────────────────────────────────────────

/**
 * Try to decode an Auth.js JWE with a single salt value.
 */
async function tryDecode(
  token: string,
  secret: string,
  salt: string | undefined
): Promise<Record<string, unknown> | null> {
  const { decode } = await import("next-auth/jwt");
  try {
    const params: { token: string; secret: string; salt?: string } = { token, secret };
    if (salt !== undefined) params.salt = salt;
    const payload = await decode(params);
    return (payload as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/**
 * Try multiple salt values. Auth.js v5 beta uses different salt conventions:
 *   - undefined:  salt not passed (encode called without salt)
 *   - cookie name:  getToken() passes salt = cookieName
 *   - empty string: some versions use ""
 */
async function decodeWithRetry(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  // Salt candidates in order of likelihood
  const salts: (string | undefined)[] = [
    undefined,                // encode without salt (most common)
    "authjs.session-token",   // getToken() behavior in dev
    "__Secure-authjs.session-token", // getToken() behavior in prod
    "",                        // some versions use empty string
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ];

  for (const salt of salts) {
    const label = salt === undefined ? "undefined" : `"${salt}"`;
    const payload = await tryDecode(token, secret, salt);
    if (payload) {
      console.log(`[socket-auth] JWE decoded with salt=${label}`);
      return payload;
    }
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Extract and validate a session from the cookie header of a
 * Socket.io handshake request.
 *
 * @param cookieHeader  Raw Cookie header from the HTTP upgrade request
 * @param secret        Auth.js AUTH_SECRET from server.ts (raw Node.js env)
 */
export async function extractSessionFromCookie(
  cookieHeader: string,
  secret: string
): Promise<SocketSession | null> {
  if (!cookieHeader) {
    console.log("[socket-auth] No cookie header present");
    return null;
  }

  const cookieNames = cookieHeader
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter(Boolean);
  console.log(
    `[socket-auth] Cookie names received: [${cookieNames.join(", ")}]`
  );

  const rawToken = extractSessionToken(cookieHeader);
  if (!rawToken) {
    console.log("[socket-auth] No session token found in any known cookie pattern");
    return null;
  }

  if (typeof secret !== "string" || secret.length === 0) {
    console.error(
      `[socket-auth] Invalid secret (type=${typeof secret}, len=${
        typeof secret === "string" ? secret.length : "n/a"
      })`
    );
    return null;
  }

  console.log(`[socket-auth] Attempting decode (token=${rawToken.length} chars, secret=${secret.length} chars)`);

  const payload = await decodeWithRetry(rawToken, secret);
  if (!payload) {
    console.warn("[socket-auth] All decode attempts failed — secret/key mismatch or token expired");
    return null;
  }

  const userId = (payload.id ?? payload.sub) as string | undefined;
  const role = (payload.role as string) ?? "STUDENT";

  if (!userId) {
    console.warn("[socket-auth] Decoded payload missing userId:", Object.keys(payload));
    return null;
  }

  if (role !== "STUDENT" && role !== "ADMIN") {
    console.warn(`[socket-auth] Unexpected role: "${role}" — defaulting to STUDENT`);
    return { userId, role: "STUDENT" };
  }

  console.log(`[socket-auth] Session resolved: userId=${userId}, role=${role}`);
  return { userId, role };
}
