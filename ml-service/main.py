"""
CaféSmart ML Microservice — FastAPI Application

Internal service consumed exclusively by the Next.js server (AD-5).
No CORS middleware — network isolation is the trust boundary.
"""

import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from forecaster import run_forecast, MODELS_DIR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CaféSmart ML Service",
    version="0.1.0",
    description="Internal ML inference service for CaféSmart canteen system.",
)


# ── Request / Response models ────────────────────────────────────

class ForecastItem(BaseModel):
    menuItemId: str
    name: str = ""
    historical_sales: list[float] = []
    pre_order_count: int = 0
    day_of_week: int = 0
    is_weekend: bool = False
    days_since_launch: int = 0
    rolling_7d_avg: float = 0.0
    rolling_14d_avg: float = 0.0


class ForecastRequest(BaseModel):
    date: str
    semester_period: str = "REGULAR_LECTURES"
    items: list[ForecastItem]


class ForecastResult(BaseModel):
    menuItemId: str
    predictedQty: int
    lowEstimate: int
    highEstimate: int
    confidenceScore: float
    modelVersion: str


class ForecastResponse(BaseModel):
    date: str
    forecasts: list[ForecastResult]


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/forecast", response_model=ForecastResponse)
async def forecast(request: ForecastRequest):
    """Generate per-item demand predictions for tomorrow."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    items_payload = [item.model_dump() for item in request.items]
    try:
        results = run_forecast(items_payload, request.semester_period)
    except Exception as e:
        logger.exception("Forecast failed")
        raise HTTPException(status_code=500, detail=str(e))

    return ForecastResponse(date=request.date, forecasts=[ForecastResult(**r) for r in results])
