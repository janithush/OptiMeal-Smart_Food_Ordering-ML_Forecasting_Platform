import { NextResponse } from "next/server";

/**
 * GET /api/ml/health
 *
 * Proxies the internal ML microservice health check (AD-5).
 * This Route Handler runs exclusively on the server — the browser
 * never communicates with the ML service directly.
 *
 * Returns:
 *   200 — { "status": "ok", "models": [...], "models_loaded": N } when reachable
 *   500 — { "status": "error", "message": "..." } when ML_SERVICE_URL is not configured
 *   503 — { "status": "error", "message": "..." } when ML service is unreachable
 */
export async function GET() {
  const mlServiceUrl = process.env.ML_SERVICE_URL;

  if (!mlServiceUrl) {
    return NextResponse.json(
      { status: "error", message: "ML_SERVICE_URL not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${mlServiceUrl}/health`, {
      // Always bypass Next's data cache for a health probe.
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { status: "error", message: "ML service unavailable" },
      { status: 503 }
    );
  }
}
