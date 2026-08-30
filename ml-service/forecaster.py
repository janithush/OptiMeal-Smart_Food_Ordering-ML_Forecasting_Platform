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
LOOKBACK = 7  # Days of historical sales used as features
DOMAIN_FEATURE_COUNT = 10  # One for each entry in FEATURE_NAMES below
FEATURE_COUNT = LOOKBACK + DOMAIN_FEATURE_COUNT  # = 17
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

# Sanity check on the canonical feature list length.
assert len(FEATURE_NAMES) == DOMAIN_FEATURE_COUNT, (
    "FEATURE_NAMES length must match DOMAIN_FEATURE_COUNT"
)


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
    """Build the (1, 10) domain-only feature vector from an item payload dict.

    NOTE: This is the *domain* portion of the feature vector only — used as
    a building block for the full training/inference vector (see
    ``_build_full_feature_vector``). It is NOT fed directly to the scaler,
    because the StandardScaler was fit on the concatenated historical window
    plus these 10 domain features (17 total). Calling scaler.transform on
    this vector alone raises ``ValueError: X has 10 features, but
    StandardScaler is expecting 17 features as input``.
    """
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


def _build_full_feature_vector(item: dict, lookback: int = 7) -> np.ndarray:
    """Build the (1, lookback + 10) feature vector used by both training and prediction.

    Layout MUST match what ``train_model`` feeds to the StandardScaler, otherwise
    the scaler will raise a feature-count mismatch at inference time.

    Order:
        [last ``lookback`` sales | 10 domain features]

    The trailing ``lookback`` sales are taken from ``item["historical_sales"]``.
    If the payload has fewer than ``lookback`` days of history, the missing
    trailing slots are zero-padded (this is a deliberate choice — the model
    was trained with sliding windows of the same length, so a short window
    at inference time will degrade the prediction but at least stays
    dimensionally valid). Callers that want to avoid degraded predictions
    should route to the fallback path instead (see ``predict``).
    """
    history = item.get("historical_sales", []) or []
    # Take the most-recent ``lookback`` values; zero-pad on the left if shorter.
    if len(history) >= lookback:
        window = [float(v) for v in history[-lookback:]]
    else:
        window = [0.0] * (lookback - len(history)) + [float(v) for v in history]

    domain = _build_feature_vector(item).reshape(-1).tolist()
    full = [*window, *domain]
    vec = np.array(full, dtype=np.float64).reshape(1, -1)
    assert vec.shape[1] == FEATURE_COUNT, (
        f"_build_full_feature_vector produced {vec.shape[1]} features; "
        f"expected FEATURE_COUNT={FEATURE_COUNT} ({LOOKBACK} history + "
        f"{DOMAIN_FEATURE_COUNT} domain)"
    )
    return vec


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

    artifact = {"model": model, "scaler": scaler, "rmse": rmse, "last_r2": r2, "mae": float(np.mean(np.abs(residuals)))}
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

    Returns ``modelVersion="linear-regression-v1"`` when a trained model
    is used, and ``modelVersion="fallback-actuals"`` when the prediction
    is from the deterministic fallback path. This lets the admin
    dashboard surface low-confidence predictions.
    """
    item_name = item.get("name", item.get("menuItemId", "unknown"))
    historical_sales = item.get("historical_sales", []) or []
    model_path = MODELS_DIR / f"{item_name}.pkl"

    # If we have a model on disk but insufficient history to build the
    # 7-day historical window it was trained on, route to the fallback.
    # Feeding a zero-padded window to a scaler fit on real sales would
    # produce a nonsense prediction (and silently worsen the forecast),
    # so we explicitly bail to the deterministic estimator instead.
    if model_path.exists() and len(historical_sales) < 7:
        logger.info(
            "Insufficient history (%d days) for model '%s', using fallback",
            len(historical_sales),
            item_name,
        )
        return _fallback_prediction(
            item_name=item_name,
            historical_sales=historical_sales,
            menu_item_id=item.get("menuItemId"),
        )

    if model_path.exists():
        try:
            # MUST use the full 17-feature vector (7-day history + 10 domain)
            # to match the StandardScaler fit during training — otherwise we
            # get: ValueError: X has 10 features, but StandardScaler is
            # expecting 17 features as input.
            features = _build_full_feature_vector(item, lookback=7)
            artifact = joblib.load(model_path)
            X_scaled = artifact["scaler"].transform(features)
            predicted_raw = artifact["model"].predict(X_scaled)[0]
            rmse = artifact.get("rmse", 3.0)
            r2 = artifact.get("last_r2", 0.75)
            predicted = max(0.0, predicted_raw)
        except Exception:
            logger.exception("Failed to load model for %s, using fallback", item_name)
            fb = _fallback_prediction(
                item_name=item_name,
                historical_sales=item.get("historical_sales", []),
                menu_item_id=item.get("menuItemId"),
            )
            # Carry over the semester-aware moving-average estimate but
            # mark the result as a fallback so the dashboard can flag it.
            return fb
    else:
        logger.info("No model found for '%s', using fallback prediction", item_name)
        return _fallback_prediction(
            item_name=item_name,
            historical_sales=item.get("historical_sales", []),
            menu_item_id=item.get("menuItemId"),
        )

    low = max(0.0, predicted - rmse)
    high = predicted + rmse
    # Confidence reflects trained-model quality (R²), but is clamped into a
    # meaningful band [20, 95]:
    #   * Floor of 20% — never claim effectively-zero or negative confidence;
    #     R² can be negative when the model is worse than the baseline mean,
    #     which would otherwise yield meaningless 0% / -12% confidence.
    #   * Ceiling of 95% — the dashboard treats ≥95% as "highly confident";
    #     an exact 100% implies the model is perfect, which is rarely true in
    #     production and risks the admin dismissing other signals.
    #   * NaN R² (corrupt artifact) → fall back to 50% (uncertain).
    confidence = _confidence_from_r2(r2)

    return {
        "menuItemId": item.get("menuItemId", ""),
        "predictedQty": max(0, int(round(predicted))),
        "lowEstimate": max(0, int(round(low))),
        "highEstimate": max(0, int(round(high))),
        "confidenceScore": round(confidence, 2),
        "modelVersion": "linear-regression-v1",
    }


def _confidence_from_r2(r2: float) -> float:
    """Map a trained model's R² score to a 0–100 confidence percentage.

    The mapping is bounded in [20.0, 95.0] so the dashboard never sees a
    meaningless 0% / 100% / negative value. NaN or non-finite R² (e.g.
    a corrupt .pkl artifact) collapses to 50% (maximum uncertainty) so
    the admin is prompted to investigate the artifact rather than
    trusting an automated forecast.
    """
    try:
        r2_val = float(r2)
    except (TypeError, ValueError):
        return 50.0
    if r2_val != r2_val:  # NaN check (NaN != NaN)
        return 50.0
    # Linear scale: R²=0.0 → 20%, R²=1.0 → 95% (but R² rarely hits 1.0 in
    # production). Negative R² (model worse than baseline mean) floors at 20%.
    scaled = max(0.0, min(1.0, r2_val)) * 100.0
    return max(20.0, min(95.0, scaled * 0.75 + 20.0))


def _moving_average(values: list[float], window: int = 7) -> float:
    if not values:
        return 0.0
    recent = values[-window:] if len(values) >= window else values
    return sum(recent) / len(recent)


def _fallback_predict(item: dict, _features=None) -> dict:
    """Fallback: use 7-day moving average with semester adjustment.

    Used internally by `predict()` when no per-item model exists. The result
    intentionally uses ``modelVersion="linear-regression-v1"`` for backward
    compatibility with clients that did not expect the new fallback marker.
    """
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


def _fallback_prediction(
    item_name: str,
    historical_sales: list[float],
    menu_item_id: str | None = None,
) -> dict:
    """
    Public fallback used when no trained model exists and the item has no
    usable history either (or the model file failed to load).

    Strategy:
      - If historical_sales is empty → predict 5 with low confidence (~20%).
      - Otherwise → use the 7-day moving average, with confidence scaled by
        the number of days of history (capped at 70%).

    Always returns ``modelVersion == "fallback-actuals"`` so the dashboard
    can surface that the forecast is not from a trained model.
    """
    n = len(historical_sales)
    if n == 0:
        predicted = 5
        rmse = 3.0
        confidence = 20.0
    else:
        avg = _moving_average(historical_sales, window=7)
        predicted = max(1, int(round(avg)))
        rmse = max(2.0, avg * 0.20)
        # 0 days → 20%, 14+ days → 70%
        confidence = min(70.0, 20.0 + (n * 3.5))

    return {
        "menuItemId": menu_item_id or item_name,
        "itemName": item_name,
        "predictedQty": predicted,
        "lowEstimate": max(0, int(round(predicted - rmse))),
        "highEstimate": max(0, int(round(predicted + rmse))),
        "confidenceScore": round(confidence, 2),
        "modelVersion": "fallback-actuals",
        "rowsUsed": n,
    }


def list_loaded_models() -> list[str]:
    """Return the names of all menu items that have a trained model on disk."""
    if not MODELS_DIR.exists():
        return []
    return sorted(
        p.stem
        for p in MODELS_DIR.glob("*.pkl")
        if p.is_file()
    )


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


# ── Retraining (Story 7.6) ────────────────────────────────────────

def retrain_model(item_name: str, historical_sales: list[float], semester_period: str = "REGULAR_LECTURES") -> dict:
    """
    Retrain a single item's LR model with all available data.
    Performs atomic backup before overwrite and rollback if new MAE
    is >20% worse than the old model's MAE.

    Returns a dict with training metrics.
    """
    import shutil
    from datetime import datetime
    from sklearn.metrics import mean_absolute_error

    model_path = MODELS_DIR / f"{item_name}.pkl"
    backup_dir = MODELS_DIR / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Load old model metrics for comparison
    old_mae = None
    old_r2 = None
    if model_path.exists():
        try:
            old = joblib.load(model_path)
            old_mae = old.get("mae", None)
            old_r2 = old.get("last_r2", None)
        except Exception:
            logger.warning("Could not load old model for %s", item_name)

    # Backup old model before retraining
    if model_path.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"{item_name}_{timestamp}.pkl"
        shutil.copy2(model_path, backup_path)
        logger.info("Backed up model for '%s' → %s", item_name, backup_path)

    # Build training data
    if len(historical_sales) < 9:
        # Not enough data to fit a Linear Regression reliably. Return an
        # HONEST signal: do NOT claim a successful retrain, do NOT mark
        # with the trained-model version, and critically do NOT touch the
        # existing .pkl on disk. Existing model (if any) stays in place.
        logger.info(
            "Skipping retrain for '%s' — insufficient data (%d rows, need ≥9)",
            item_name,
            len(historical_sales),
        )
        return {
            "menuItemId": item_name,
            "itemName": item_name,
            "rowsUsed": len(historical_sales),
            "mae": 0.0,
            "r2": 0.0,
            "rolledBack": False,
            "modelVersion": "insufficient-data",
            "rollbackReason": None,
            "skipped": True,
            "reason": "insufficient_data",
        }

    # Build feature vector (default features for retraining)
    features = np.array([[0, 0, 0, 0.0, 0.0, 0, 1, 0, 0, 0]], dtype=np.float64)
    if semester_period:
        one_hot = _one_hot_semester(semester_period)
        features = np.array([[0, 0, 0, 0.0, 0.0, 0, *one_hot]], dtype=np.float64)

    X_hist, y_hist = _build_training_data(historical_sales)
    if X_hist is None:
        # _build_training_data itself rejected the rows (e.g. < lookback+2).
        # Same honest-short-circuit semantics as above.
        logger.info(
            "Skipping retrain for '%s' — could not build training pairs from %d rows",
            item_name,
            len(historical_sales),
        )
        return {
            "menuItemId": item_name,
            "itemName": item_name,
            "rowsUsed": len(historical_sales),
            "mae": 0.0,
            "r2": 0.0,
            "rolledBack": False,
            "modelVersion": "insufficient-data",
            "rollbackReason": None,
            "skipped": True,
            "reason": "insufficient_data",
        }

    n_samples = X_hist.shape[0]
    domain_features = np.tile(features, (n_samples, 1))
    X_combined = np.hstack([X_hist, domain_features])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_combined)

    model = LinearRegression()
    model.fit(X_scaled, y_hist)

    y_pred = model.predict(X_scaled)
    r2 = float(model.score(X_scaled, y_hist))
    mae = float(mean_absolute_error(y_hist, y_pred))
    residuals = y_hist - y_pred
    rmse = float(np.std(residuals))

    # Check rollback: if old model exists and new MAE > old MAE * 1.20
    rolled_back = False
    rollback_reason = None

    if old_mae is not None and mae > old_mae * 1.20:
        rolled_back = True
        rollback_reason = (
            f"MAE increased from {old_mae:.1f} to {mae:.1f} "
            f"({((mae / old_mae - 1) * 100):.0f}% degradation > 20% threshold)"
        )
        logger.warning("Rollback for '%s': %s", item_name, rollback_reason)

        # Restore from backup
        if backup_path and backup_path.exists():
            shutil.copy2(backup_path, model_path)
            logger.info("Restored backup for '%s' from %s", item_name, backup_path)
    else:
        # Save new model (already trained above)
        artifact = {"model": model, "scaler": scaler, "rmse": rmse, "last_r2": r2, "mae": mae}
        joblib.dump(artifact, model_path)
        logger.info("Retrained model for '%s' — MAE=%.2f, R²=%.3f → %s", item_name, mae, r2, model_path)

    return {
        "menuItemId": item_name,
        "itemName": item_name,
        "rowsUsed": len(historical_sales),
        "mae": round(mae, 2),
        "r2": round(r2, 4),
        "rolledBack": rolled_back,
        "modelVersion": "linear-regression-v1",
        "rollbackReason": rollback_reason,
    }


def run_retrain(items: list[dict], semester_period: str = "REGULAR_LECTURES") -> list[dict]:
    """
    Retrain models for all provided items. Returns per-item results.
    """
    results = []
    for item in items:
        historical = item.get("historical_sales", [])
        result = retrain_model(
            item.get("name", item.get("menuItemId", "unknown")),
            historical,
            semester_period,
        )
        # Override menuItemId with the one from the request
        result["menuItemId"] = item.get("menuItemId", result["menuItemId"])
        results.append(result)
    return results
