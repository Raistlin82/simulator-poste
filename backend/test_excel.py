"""
Smoke + regression tests for the scoring Excel export.

Covers the economic-score cap fix: the headline PUNTEGGIO ECONOMICO must never
exceed max_econ (the Rapporto is clamped to [0,1] with actual_best, matching
ScoringService.calculate_economic_score).
"""
import io

import openpyxl

from excel_generator import ExcelReportGenerator


def _make_excel():
    gen = ExcelReportGenerator(
        lot_key="Lotto 2",
        lot_config={"reqs": [], "company_certs": [], "rti_enabled": False, "rti_companies": []},
        base_amount=1_000_000, my_discount=25, competitor_discount=30,
        technical_score=50, economic_score=20, total_score=70,
        details={}, weighted_scores={},
        category_scores={"company_certs": 0, "resource": 0, "reference": 0, "project": 0},
        max_tech_score=60, max_econ_score=40, alpha=0.3, win_probability=65,
        tech_inputs_full={}, rti_quotas={},
    )
    return gen.generate()


def test_scoring_excel_generates():
    buf = _make_excel()
    assert len(buf.getvalue()) > 5000


def test_economic_ratio_is_clamped():
    """The Rapporto cell must clamp to [0,1] using actual_best so the score cell
    cannot exceed max_econ when our offer beats the market best."""
    wb = openpyxl.load_workbook(io.BytesIO(_make_excel().getvalue()))
    formulas = [
        c.value for ws in wb.worksheets for row in ws.iter_rows()
        for c in row if isinstance(c.value, str) and c.value.startswith("=")
    ]
    clamped = [f for f in formulas if "MIN(1," in f and "MIN(C" in f]
    assert clamped, "expected a clamped Rapporto formula (MIN(1, .../(base-MIN(mio,best))))"
