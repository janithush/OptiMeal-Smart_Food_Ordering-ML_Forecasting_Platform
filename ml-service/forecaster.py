"""
CaféSmart ML Forecaster — Per-item Linear Regression with semester awareness.

Feature engineering, model training, and prediction for the nightly
demand forecast pipeline. Each active menu item gets its own LR model
persisted as a joblib .pkl file.
"""

import logging
import numpy as np
from pathlib import Path
from typing import Optional

from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import joblib

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent / "models"

SEMESTER_PERIODS = ["REGULAR_LECTURES", "PRE_EXAM_WEEK", "STUDY_LEAVE", "EXAM_PERIOD"]
FEATURE_NAMES = [
    "day_of_week",
    "is_weekend",
    "pre_order_count",
    "rolling_7d_avg",
    "rolling_14d_avg",
    "days_since_launch",
    "semester_REGULAR_LECTURES",
    "semester_PRE_EXAM_WEEK",
    "semester_STUDY_LEAVE",
    "semester_EXAM_PERIOD",
]


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _one_hot_semester(period: str) -> list[int]:
    """One-hot encode semester_period into 4 booleans."""
    encoded = [0] * 4
    try:
        idx = SEMESTER_PERIODS.index(period)
        encoded[idx] = 1
    except ValueError:
        # Unknown period defaults to REGULAR_LECTURES
        encoded[0] = 1
    return encoded


def _build_feature_vector(item: dict) -> np.ndarray:
    """Build a (1, N) feature vector from an item payload dict."""
    semester_one_hot = _one_hot_semester(item.get("semester_period", "REGULAR_LECTURES"))

    features = [
        _safe_int(item.get("day_of_week")),
        1 if item.get("is_weekend") else 0,
        _safe_int(item.get("pre_order_count")),
        _safe_float(item.get("rolling_7d_avg")),
        _safe_float(item.get("rolling_14d_avg")),
        _safe_int(item.get("days_since_launch")),
        *semester_one_hot,
    ]
    return np.array(features, dtype=np.float64).reshape(1, -1)


def _build_training_data(historical_sales: list[float], lookback: int = 7):
    """
    Build (X, y) training pairs from a list of historical daily sales.
    Uses trailing lookback days as features to predict each next day.
    Returns (X, y) or (None, None) if insufficient data.
    """
    if len(historical_sales) < lookback + 2:
        return None, None

    X_rows, y_rows = [], []
    for i in range(lookback, len(historical_sales) - 1):
        window = historical_sales[i - lookback : i]
        target = historical_sales[i + 1]
        X_rows.append(window)
        y_rows.append(target)

    if not X_rows:
        return None, None
    return np.array(X_rows, dtype=np.float64), np.array(y_rows, dtype=np.float64)


def train_model(
    item_name: str,
    historical_sales: list[float],
    features: np.ndarray,
    lookback: int = 7,
) -> Optional[float]:
    """
    Train a per-item Linear Regression model.

    Uses two feature sources concatenated:
      1. Rolling window of historical_sales (lookback days)
      2. Domain features (day_of_week, is_weekend, etc.)

    Returns R² score or None if insufficient data.
    """
    X_hist, y_hist = _build_training_data(historical_sales, lookback)
    if X_hist is None or len(historical_sales) < lookback + 2:
        logger.warning("Insufficient historical data for %s (%d records)", item_name, len(historical_sales))
        return None

    # Combine historical windows with domain features
    n_samples = X_hist.shape[0]
    domain_features = np.tile(features, (n_samples, 1))
    X_combined = np.hstack([X_hist, domain_features])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_combined)

    model = LinearRegression()
    model.fit(X_scaled, y_hist)

    r2 = model.score(X_scaled, y_hist)
    residuals = y_hist - model.predict(X_scaled)
    rmse = float(np.std(residuals))

    artifact = {"model": model, "scaler": scaler, "rmse": rmse, "last_r2": r2}
    model_path = MODELS_DIR / f"{item_name}.pkl"
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, model_path)
    logger.info("Trained model for '%s' — R²=%.3f, RMSE=%.2f → %s", item_name, r2, rmse, model_path)

    return r2


def predict(item: dict) -> dict:
    """
    Predict next-day demand for a menu item.

    Loads the trained model from disk. If no model exists yet, falls back
    to a simple 7-day moving average with a heuristic adjustment for the
    semester_period.
    """
    item_name = item.get("name", item.get("menuItemId", "unknown"))
    features = _build_feature_vector(item)
    model_path = MODELS_DIR / f"{item_name}.pkl"

    if model_path.exists():
        try:
            artifact = joblib.load(model_path)
            X_scaled = artifact["scaler"].transform(features)
            predicted_raw = artifact["model"].predict(X_scaled)[0]
            rmse = artifact.get("rmse", 3.0)
            r2 = artifact.get("last_r2", 0.75)
            predicted = max(0.0, predicted_raw)
        except Exception:
            logger.exception("Failed to load model for %s, using fallback", item_name)
            return _fallback_predict(item, features)
    else:
        logger.info("No model found for '%s', using fallback prediction", item_name)
        return _fallback_predict(item, features)

    low = max(0.0, predicted - rmse)
    high = predicted + rmse
    confidence = min(r2 * 100, 100.0)

    return {
        "menuItemId": item.get("menuItemId", ""),
        "predictedQty": max(0, int(round(predicted))),
        "lowEstimate": max(0, int(round(low))),
        "highEstimate": max(0, int(round(high))),
        "confidenceScore": round(confidence, 2),
        "modelVersion": "linear-regression-v1",
    }


def _moving_average(values: list[float], window: int = 7) -> float:
    if not values:
        return 0.0
    recent = values[-window:] if len(values) >= window else values
    return sum(recent) / len(recent)


def _fallback_predict(item: dict, _features=None) -> dict:
    """Fallback: use 7-day moving average with semester adjustment."""
    historical = item.get("historical_sales", [])
    avg = _moving_average(historical, 7)
    period = item.get("semester_period", "REGULAR_LECTURES")

    # Heuristic semester multipliers
    multipliers = {
        "REGULAR_LECTURES": 1.0,
        "PRE_EXAM_WEEK": 0.85,
        "STUDY_LEAVE": 0.40,
        "EXAM_PERIOD": 0.35,
    }
    multiplier = multipliers.get(period, 1.0)
    predicted = avg * multiplier
    rmse = max(2.0, avg * 0.20)

    return {
        "menuItemId": item.get("menuItemId", ""),
        "predictedQty": max(0, int(round(predicted))),
        "lowEstimate": max(0, int(round(predicted - rmse))),
        "highEstimate": max(0, int(round(predicted + rmse))),
        "confidenceScore": 50.0,
        "modelVersion": "linear-regression-v1",
    }


def run_forecast(items: list[dict], semester_period: str) -> list[dict]:
    """
    Main entry point: train models (if needed) and predict for all items.
    """
    forecasts = []
    for item in items:
        item["semester_period"] = semester_period
        item.setdefault("day_of_week", 0)
        item.setdefault("is_weekend", False)
        item.setdefault("pre_order_count", 0)
        item.setdefault("rolling_7d_avg", 0.0)
        item.setdefault("rolling_14d_avg", 0.0)
        item.setdefault("days_since_launch", 0)
        item.setdefault("historical_sales", [])

        historical = item.get("historical_sales", [])

        if len(historical) >= 9:
            features = _build_feature_vector(item)
            train_model(item.get("name", item["menuItemId"]), historical, features)

        result = predict(item)
        forecasts.append(result)

    return forecasts
