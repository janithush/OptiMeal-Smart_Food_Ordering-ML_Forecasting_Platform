"""
Unit tests for the small pure-Python helpers in forecaster.py.

These tests intentionally avoid sklearn / joblib so they run in milliseconds
and don't require any pre-trained model artifacts.
"""

import pytest

from forecaster import (
    _safe_int,
    _safe_float,
    _one_hot_semester,
    SEMESTER_PERIODS,
    _build_feature_vector,
    _build_training_data,
)


class TestSafeInt:
    def test_valid_int(self):
        assert _safe_int("5") == 5
        assert _safe_int(5) == 5

    def test_valid_zero(self):
        assert _safe_int("0") == 0

    def test_invalid_returns_default(self):
        assert _safe_int("not-a-number") == 0
        assert _safe_int(None) == 0
        assert _safe_int(None, default=42) == 42

    def test_float_string(self):
        # "3.7" can't be losslessly parsed as int → return default
        assert _safe_int("3.7") == 0


class TestSafeFloat:
    def test_valid_float(self):
        assert _safe_float("3.14") == pytest.approx(3.14)
        assert _safe_float(2.5) == pytest.approx(2.5)

    def test_invalid_returns_default(self):
        assert _safe_float("oops") == 0.0
        assert _safe_float(None) == 0.0
        assert _safe_float(None, default=99.0) == 99.0


class TestOneHotSemester:
    def test_all_four_periods(self):
        for i, period in enumerate(SEMESTER_PERIODS):
            one_hot = _one_hot_semester(period)
            assert len(one_hot) == 4
            assert one_hot[i] == 1
            assert sum(one_hot) == 1

    def test_unknown_defaults_to_regular_lectures(self):
        one_hot = _one_hot_semester("UNKNOWN_PERIOD")
        assert one_hot == [1, 0, 0, 0]

    def test_empty_string_defaults_to_regular_lectures(self):
        one_hot = _one_hot_semester("")
        assert one_hot == [1, 0, 0, 0]


class TestBuildFeatureVector:
    def test_returns_one_row_with_ten_features(self):
        item = {
            "day_of_week": 2,
            "is_weekend": False,
            "pre_order_count": 10,
            "rolling_7d_avg": 25.5,
            "rolling_14d_avg": 23.1,
            "days_since_launch": 100,
        }
        X = _build_feature_vector(item)
        assert X.shape == (1, 10)
        assert X[0, 0] == 2   # day_of_week
        assert X[0, 1] == 0   # is_weekend
        assert X[0, 2] == 10  # pre_order_count
        assert X[0, 3] == pytest.approx(25.5)
        # last 4 are the one-hot semester (default = REGULAR_LECTURES)
        assert list(X[0, 6:10]) == [1, 0, 0, 0]

    def test_weekend_flag(self):
        item = {"is_weekend": True}
        X = _build_feature_vector(item)
        assert X[0, 1] == 1

    def test_uses_period_from_item(self):
        item = {"semester_period": "EXAM_PERIOD"}
        X = _build_feature_vector(item)
        assert list(X[0, 6:10]) == [0, 0, 0, 1]


class TestBuildTrainingData:
    def test_insufficient_data_returns_none(self):
        X, y = _build_training_data([1, 2, 3, 4, 5, 6, 7, 8], lookback=7)
        assert X is None
        assert y is None

    def test_builds_correct_window_shape(self):
        sales = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
        # lookback=7, len=11 → pairs from i=7 to i=9 (inclusive) → 3 rows
        X, y = _build_training_data(sales, lookback=7)
        assert X is not None and y is not None
        assert X.shape[0] == 3
        assert y.shape[0] == 3
        # First window uses sales[0:7] → predicts sales[8] = 26
        assert list(X[0]) == [10, 12, 14, 16, 18, 20, 22]
        assert y[0] == 26
