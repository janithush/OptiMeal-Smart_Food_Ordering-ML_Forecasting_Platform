"""
End-to-end FastAPI tests using TestClient (no live network, no DB).

These tests exercise the public HTTP surface (`/health`, `/forecast`, `/train`)
and verify contract: required fields, status codes, error handling.
"""

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_returns_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


def test_forecast_returns_at_least_one_forecast_for_each_item(client):
    payload = {
        "date": "2026-08-30",
        "semester_period": "REGULAR_LECTURES",
        "items": [
            {
                "menuItemId": "item-1",
                "name": "Test Item",
                "historical_sales": [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
                "pre_order_count": 5,
                "day_of_week": 1,
                "is_weekend": False,
                "days_since_launch": 100,
                "rolling_7d_avg": 22.0,
                "rolling_14d_avg": 20.0,
            }
        ],
    }
    r = client.post("/forecast", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == "2026-08-30"
    assert len(body["forecasts"]) == 1
    fc = body["forecasts"][0]
    assert fc["menuItemId"] == "item-1"
    assert fc["predictedQty"] > 0
    assert fc["lowEstimate"] <= fc["predictedQty"] <= fc["highEstimate"]


def test_forecast_uses_fallback_for_unknown_item_with_no_history(client):
    payload = {
        "date": "2026-08-30",
        "semester_period": "REGULAR_LECTURES",
        "items": [
            {
                "menuItemId": "brand-new",
                "name": "Brand New Item",
                "historical_sales": [],
                "pre_order_count": 0,
                "day_of_week": 1,
                "is_weekend": False,
                "days_since_launch": 0,
                "rolling_7d_avg": 0.0,
                "rolling_14d_avg": 0.0,
            }
        ],
    }
    r = client.post("/forecast", json=payload)
    assert r.status_code == 200
    body = r.json()
    fc = body["forecasts"][0]
    assert fc["menuItemId"] == "brand-new"
    # When using the fallback path the modelVersion is marked accordingly
    assert fc["modelVersion"] == "fallback-actuals"
    # low confidence because no history
    assert fc["confidenceScore"] < 50.0


def test_forecast_handles_empty_items_list(client):
    payload = {"date": "2026-08-30", "semester_period": "REGULAR_LECTURES", "items": []}
    r = client.post("/forecast", json=payload)
    assert r.status_code == 200
    assert r.json()["forecasts"] == []


def test_forecast_rejects_malformed_payload(client):
    r = client.post("/forecast", json={"date": "2026-08-30"})
    assert r.status_code == 422  # Pydantic validation error


def test_health_lists_loaded_models(client):
    """The upgraded /health endpoint should report model inventory."""
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert "status" in body
    # Either there are models present in the repo, or the field is absent
    # (the contract allows both for backward compat)
    if "models" in body:
        assert isinstance(body["models"], list)


def test_forecast_uses_trained_model_when_history_available(client):
    """Regression: previously the /forecast endpoint raised
    ``ValueError: X has 10 features, but StandardScaler is expecting 17
    features as input`` because ``predict()`` fed only the 10 domain
    features to a scaler that had been fit on the 17-feature vector
    (7-day history window + 10 domain features). For a known menu item
    with a model on disk and >=7 days of history, the response must
    use the trained model (modelVersion == "linear-regression-v1")
    rather than falling back.
    """
    # Discover a real menu item that has a trained model artifact on disk.
    from forecaster import MODELS_DIR, list_loaded_models

    if not MODELS_DIR.exists():
        pytest.skip("models/ directory missing — no trained models to test against")

    trained_items = [
        m for m in list_loaded_models() if (MODELS_DIR / f"{m}.pkl").exists()
    ]
    if not trained_items:
        pytest.skip("No trained model artifacts found in models/ — skipping")

    item_name = trained_items[0]
    payload = {
        "date": "2026-08-30",
        "semester_period": "REGULAR_LECTURES",
        "items": [
            {
                "menuItemId": item_name,
                "name": item_name,
                # 14 days of history so the predict path is exercised
                # with a valid 7-day window (lookback=7).
                "historical_sales": [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
                "pre_order_count": 5,
                "day_of_week": 1,
                "is_weekend": False,
                "days_since_launch": 100,
                "rolling_7d_avg": 22.0,
                "rolling_14d_avg": 20.0,
            }
        ],
    }
    r = client.post("/forecast", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    fc = r.json()["forecasts"][0]
    assert fc["modelVersion"] == "linear-regression-v1", (
        f"Expected trained-model prediction, got modelVersion={fc['modelVersion']!r}. "
        "This typically indicates the feature-vector dimension mismatch regression "
        "(StandardScaler expecting 17 features but receiving 10)."
    )
    assert fc["predictedQty"] >= 0
