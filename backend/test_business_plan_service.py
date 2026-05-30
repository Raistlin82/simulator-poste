"""
Unit tests for BusinessPlanService — the cost/margin engine that drives bid
decisions. These cover the pure, high-value formulas (reuse factor, margin,
and the discount<->margin round trip). They run without a database.
"""
import pytest

from services.business_plan_service import BusinessPlanService as BP


class TestReuseFactor:
    def test_no_reuse_returns_full_effort(self):
        assert BP.apply_reuse_factor(100.0, 0.0) == 100.0

    def test_full_reuse_returns_zero(self):
        assert BP.apply_reuse_factor(100.0, 1.0) == 0.0

    def test_partial_reuse(self):
        assert BP.apply_reuse_factor(100.0, 0.3) == pytest.approx(70.0)


class TestMargin:
    def test_margin_no_discount(self):
        r = BP.calculate_margin(base_amount=1000.0, total_cost=600.0, discount_pct=0.0)
        assert r["revenue"] == 1000.0
        assert r["margin"] == 400.0
        assert r["margin_pct"] == pytest.approx(40.0)

    def test_margin_with_discount(self):
        r = BP.calculate_margin(base_amount=1000.0, total_cost=600.0, discount_pct=20.0)
        assert r["revenue"] == 800.0
        assert r["margin"] == 200.0
        assert r["margin_pct"] == pytest.approx(25.0)

    def test_rti_quota_reduces_revenue(self):
        full = BP.calculate_margin(1000.0, 300.0, 0.0, is_rti=False)
        rti = BP.calculate_margin(1000.0, 300.0, 0.0, is_rti=True, quota_lutech=0.5)
        assert rti["revenue"] == full["revenue"] * 0.5

    def test_zero_revenue_does_not_divide_by_zero(self):
        r = BP.calculate_margin(base_amount=0.0, total_cost=100.0, discount_pct=0.0)
        assert r["margin_pct"] == 0.0


class TestFindDiscountForMargin:
    def test_roundtrip_recovers_target_margin(self):
        """find_discount_for_margin then calculate_margin must reproduce the target."""
        base, cost, target = 1000.0, 500.0, 30.0
        discount = BP.find_discount_for_margin(base, cost, target)
        achieved = BP.calculate_margin(base, cost, discount_pct=discount)
        assert achieved["margin_pct"] == pytest.approx(target, abs=0.1)

    def test_roundtrip_with_rti_quota(self):
        base, cost, target, q = 2_000_000.0, 700_000.0, 15.0, 0.7
        discount = BP.find_discount_for_margin(base, cost, target, is_rti=True, quota_lutech=q)
        achieved = BP.calculate_margin(base, cost, discount_pct=discount, is_rti=True, quota_lutech=q)
        assert achieved["margin_pct"] == pytest.approx(target, abs=0.1)

    def test_clamped_to_valid_range(self):
        # Impossible target (cost > any achievable revenue) clamps to 0..100, no crash.
        d = BP.find_discount_for_margin(1000.0, 5000.0, 50.0)
        assert 0.0 <= d <= 100.0


class TestVolumeAdjustments:
    def test_global_factor_scales_fte(self):
        team = [{"profile_id": "p1", "label": "Dev", "fte": 10.0}]
        adjusted = BP.apply_volume_adjustments(team, {"global": 0.9})
        assert adjusted[0]["fte_adjusted"] == pytest.approx(9.0)
        # Original fte is preserved untouched.
        assert adjusted[0]["fte"] == 10.0

    def test_per_profile_factor_compounds_with_global(self):
        team = [{"profile_id": "p1", "label": "Dev", "fte": 10.0}]
        adjusted = BP.apply_volume_adjustments(team, {"global": 0.9, "by_profile": {"p1": 0.5}})
        assert adjusted[0]["fte_adjusted"] == pytest.approx(4.5)

    def test_no_adjustment_keeps_fte(self):
        team = [{"profile_id": "p1", "label": "Dev", "fte": 10.0}]
        adjusted = BP.apply_volume_adjustments(team, {"global": 1.0})
        assert adjusted[0]["fte_adjusted"] == pytest.approx(10.0)
