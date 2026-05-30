"""
Tests for gara_weight (competition weight) normalization in scoring.

Verifies the invariant the feature must hold:
    weighted_score == round((raw_score / max_points) * gara_weight, 2)

and that a `resource` requirement using proportional `max_points_manual`
scaling produces the expected raw score. These are real assertions, not the
previous tautological print-checks.
"""
from main import calculate_score, calculate_prof_score
from schemas import CalculateRequest, TechInput


# Reference values from the seeded `Lotto 2` / VAL_REQ_20 configuration:
#   type=resource, max_points=15, gara_weight=9.68,
#   prof_R=5, prof_C=3, max_points_manual=True
LOT_KEY = "Lotto 2"
REQ_ID = "VAL_REQ_20"
MAX_POINTS = 15
GARA_WEIGHT = 9.68


def _calc(db, r_val, c_val):
    req = CalculateRequest(
        lot_key=LOT_KEY,
        base_amount=1_000_000.0,
        competitor_discount=30.0,
        my_discount=10.0,
        tech_inputs=[TechInput(req_id=REQ_ID, r_val=r_val, c_val=c_val)],
        selected_company_certs=[],
    )
    return calculate_score(req, db)


def test_resource_raw_uses_proportional_max_points(db):
    """r_val=5, c_val=0 -> base (2*5)+(5*0)=10, scaled by 15/theoretical_max(25) = 6.0."""
    result = _calc(db, r_val=5, c_val=0)
    raw = result["details"][REQ_ID]
    assert raw == 6.0, f"expected proportional raw 6.0, got {raw}"


def test_weighted_score_respects_gara_weight_invariant(db):
    result = _calc(db, r_val=5, c_val=0)
    raw = result["details"][REQ_ID]
    weighted = result["weighted_scores"][REQ_ID]
    expected_weighted = round((raw / MAX_POINTS) * GARA_WEIGHT, 2)
    assert weighted == expected_weighted
    # With a single requirement the total technical score equals its weighted value.
    assert result["technical_score"] == weighted


def test_higher_inputs_never_exceed_max_points(db):
    """Even maxed inputs must stay within the requirement's max_points cap."""
    result = _calc(db, r_val=99, c_val=99)
    assert result["details"][REQ_ID] <= MAX_POINTS


def test_calculate_prof_score_proportional_unit():
    """Unit-level check of the proportional scaling used above (theoretical_max=25)."""
    score = calculate_prof_score(
        R=5, C=0, max_res=10, max_points=15, max_certs=5,
        max_points_manual=True, prof_R=5, prof_C=3,
    )
    assert score == 6.0
