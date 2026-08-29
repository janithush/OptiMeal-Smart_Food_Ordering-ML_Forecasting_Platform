"""
Tests for the graceful-fallback forecasting path.

When a model is missing or insufficient training data exists for a new menu
item, the forecaster must NOT raise — it must return a deterministic
prediction derived from rolling-average actuals (the "fallback" path).
"""

import pytest

from forecaster import _fallback_prediction


class TestFallbackPrediction:
    def test_returns_integer(self):
        result = _fallback_prediction(item_name="Test", historical_sales=[10, 20, 30])
        assert isinstance(result, dict)
        assert isinstance(result["predictedQty"], int)
        assert isinstance(result["lowEstimate"], int)
        assert isinstance(result["highEstimate"], int)

    def test_falls_back_to_floor_with_no_history(self):
        result = _fallback_prediction(item_name="NoHistory", historical_sales=[])
        assert result["predictedQty"] >= 1
        assert result["lowEstimate"] >= 0
        assert result["highEstimate"] >= result["predictedQty"]
        assert result["modelVersion"] == "fallback-actuals"
        assert result["confidenceScore"] < 50.0  # low confidence

    def test_uses_recent_average(self):
        # Predominantly recent sales = 100, expect predictedQty to be close to 100
        result = _fallback_prediction(
            item_name="Heavy",
            historical_sales=[10, 20, 30, 100, 100, 100, 100, 100, 100, 100],
        )
        # mean is (10+20+30 + 100*7) / 10 = 770 / 10 = 77 → high est ~115
        assert 60 <= result["predictedQty"] <= 100
        assert result["highEstimate"] > result["predictedQty"]

    def test_low_estimate_below_predicted(self):
        result = _fallback_prediction(
            item_name="X",
            historical_sales=[50, 50, 50, 50, 50, 50, 50, 50],
        )
        assert result["lowEstimate"] <= result["predictedQty"]
        assert result["highEstimate"] >= result["predictedQty"]

    def test_includes_menuItemId_and_itemName(self):
        result = _fallback_prediction(
            item_name="Rice & Curry",
            historical_sales=[40, 45, 50],
            menu_item_id="menu-1",
        )
        assert result["menuItemId"] == "menu-1"
        assert result["itemName"] == "Rice & Curry"

    def test_confidence_increases_with_more_history(self):
        few = _fallback_prediction(item_name="X", historical_sales=[10, 20])
        many = _fallback_prediction(item_name="X", historical_sales=[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140])
        assert many["confidenceScore"] > few["confidenceScore"]
