/**
 * ml-client.ts — HTTP client for the FastAPI ML microservice.
 *
 * All communication with the internal ML service goes through this module.
 * ML service is internal-only (AD-5) — never called from browser code.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

export interface MLForecastItem {
  menuItemId: string;
  name: string;
  historical_sales: number[];
  pre_order_count: number;
  day_of_week: number;
  is_weekend: boolean;
  days_since_launch: number;
  rolling_7d_avg: number;
  rolling_14d_avg: number;
}

export interface MLForecastPayload {
  date: string;
  semester_period: string;
  items: MLForecastItem[];
}

export interface MLForecastResult {
  menuItemId: string;
  predictedQty: number;
  lowEstimate: number;
  highEstimate: number;
  confidenceScore: number;
  modelVersion: string;
}

export interface MLForecastResponse {
  date: string;
  forecasts: MLForecastResult[];
}

/**
 * Call the FastAPI /forecast endpoint.
 * Returns parsed forecast results or throws on network/HTTP error.
 */
export async function callMLForecast(
  payload: MLForecastPayload
): Promise<MLForecastResult[]> {
  const url = `${ML_SERVICE_URL}/forecast`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`ML service returned ${res.status}: ${text}`);
    }

    const json: MLForecastResponse = await res.json();
    return json.forecasts;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Quick health-check ping to verify the ML service is reachable.
 */
export async function pingMLService(): Promise<boolean> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
