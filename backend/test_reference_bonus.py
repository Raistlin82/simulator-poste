"""
Tests for the (legacy) attestazione bonus on `reference` requirements.

Intended behaviour (see `calculate_max_points_for_req` in main.py): the bonus is
added to the raw score but the total is capped at the sum of the criteria maxima
(NOT at the requirement's nominal `max_points`). So the bonus only contributes
when the criteria are below their maximum. These assertions pin that contract.

Seeded `Lotto 2` config: VAL_REQ_24 has criteria a/b/c (max 5 each -> cap 15),
VAL_REQ_25 has a/b/c/d (cap 20), both with bonus_val=3.
"""
from main import calculate_score
from schemas import CalculateRequest, TechInput


def _score(db, req_id, sub_vals, bonus_active):
    req = CalculateRequest(
        lot_key="Lotto 2",
        base_amount=1_000_000.0,
        competitor_discount=30.0,
        my_discount=10.0,
        tech_inputs=[TechInput(
            req_id=req_id,
            sub_req_vals=[{"sub_id": sid, "val": v} for sid, v in sub_vals],
            bonus_active=bonus_active,
        )],
        selected_company_certs=[],
    )
    return calculate_score(req, db)


def test_criteria_sum_without_bonus(db):
    score = _score(db, "VAL_REQ_24", [("a", 5), ("b", 5), ("c", 5)], bonus_active=False)
    assert score["details"]["VAL_REQ_24"] == 15.0


def test_bonus_does_not_exceed_criteria_cap(db):
    """Criteria already at max (15) -> bonus cannot push above the criteria cap."""
    score = _score(db, "VAL_REQ_24", [("a", 5), ("b", 5), ("c", 5)], bonus_active=True)
    assert score["details"]["VAL_REQ_24"] == 15.0


def test_bonus_applies_below_cap(db):
    """Below the cap the +3 bonus is added (14 -> 15, clamped at the 15 cap)."""
    below = [("a", 4), ("b", 5), ("c", 5)]  # sum = 14
    without = _score(db, "VAL_REQ_24", below, bonus_active=False)["details"]["VAL_REQ_24"]
    with_bonus = _score(db, "VAL_REQ_24", below, bonus_active=True)["details"]["VAL_REQ_24"]
    assert without == 14.0
    assert with_bonus == 15.0
    assert with_bonus > without


def test_second_reference_cap(db):
    """VAL_REQ_25 has four criteria -> cap 20; bonus has no room when maxed."""
    maxed = [("a", 5), ("b", 5), ("c", 5), ("d", 5)]
    assert _score(db, "VAL_REQ_25", maxed, bonus_active=False)["details"]["VAL_REQ_25"] == 20.0
    assert _score(db, "VAL_REQ_25", maxed, bonus_active=True)["details"]["VAL_REQ_25"] == 20.0
