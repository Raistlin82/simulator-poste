"""
Tests for the (legacy) attestazione bonus on `reference` requirements.

Intended behaviour: the bonus ADDS points on top of the criteria, raising the
cap by bonus_val so the "Attestazione (+N)" actually contributes — and the RAW
path stays consistent with the WEIGHTED path (which includes the bonus in both
numerator and denominator).

Seeded `Lotto 2` config: VAL_REQ_24 has criteria a/b/c (max 5 each -> 15) with
bonus_val=3 (config max_points=18 = 15+3); VAL_REQ_25 has a/b/c/d (-> 20) with
bonus_val=3 (max_points=23 = 20+3).
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


def test_bonus_adds_points_when_criteria_maxed(db):
    """Criteria at max (15) + active bonus (3) -> 18 (the +3 attestazione counts)."""
    score = _score(db, "VAL_REQ_24", [("a", 5), ("b", 5), ("c", 5)], bonus_active=True)
    assert score["details"]["VAL_REQ_24"] == 18.0


def test_bonus_adds_below_cap(db):
    """Below max: 14 criteria + 3 bonus = 17 (cap is now 15+3=18)."""
    below = [("a", 4), ("b", 5), ("c", 5)]  # sum = 14
    without = _score(db, "VAL_REQ_24", below, bonus_active=False)["details"]["VAL_REQ_24"]
    with_bonus = _score(db, "VAL_REQ_24", below, bonus_active=True)["details"]["VAL_REQ_24"]
    assert without == 14.0
    assert with_bonus == 17.0


def test_second_reference_bonus(db):
    """VAL_REQ_25: 20 criteria + 3 bonus = 23."""
    maxed = [("a", 5), ("b", 5), ("c", 5), ("d", 5)]
    assert _score(db, "VAL_REQ_25", maxed, bonus_active=False)["details"]["VAL_REQ_25"] == 20.0
    assert _score(db, "VAL_REQ_25", maxed, bonus_active=True)["details"]["VAL_REQ_25"] == 23.0
