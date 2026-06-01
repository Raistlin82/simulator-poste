"""
Domain validation for lot configuration payloads.

These checks are intentionally business-level, not persistence-level: they
protect scoring/calculation endpoints from impossible lot setups while allowing
draft configurations to remain editable.
"""

from typing import Any, Dict, List, Optional

import schemas


VALID_REQ_TYPES = {"resource", "reference", "project"}


def _as_dict(lot_config: schemas.LotConfig | Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(lot_config, schemas.LotConfig):
        return lot_config.model_dump()
    return lot_config or {}


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _issue(severity: str, code: str, message: str, blocking: bool = False) -> Dict[str, Any]:
    return {
        "severity": severity,
        "code": code,
        "message": message,
        "blocking": blocking,
    }


def validate_lot_config(
    lot_config: schemas.LotConfig | Dict[str, Any],
    master_data: Optional[schemas.MasterData | Any] = None,
) -> List[Dict[str, Any]]:
    lot = _as_dict(lot_config)
    issues: List[Dict[str, Any]] = []

    if _num(lot.get("base_amount")) <= 0:
        issues.append(_issue("error", "BASE_AMOUNT_INVALID", "Base d'asta assente o non valida.", True))

    company_certs = lot.get("company_certs") or []
    reqs = lot.get("reqs") or []
    if not company_certs:
        issues.append(_issue("warning", "NO_COMPANY_CERTS", "Nessuna certificazione aziendale configurata."))
    if not reqs:
        issues.append(_issue("warning", "NO_REQUIREMENTS", "Nessun requisito tecnico configurato."))

    cert_labels = set()
    for index, cert in enumerate(company_certs, start=1):
        label = (cert.get("label") or "").strip()
        if not label:
            issues.append(_issue("error", "COMPANY_CERT_LABEL_MISSING", f"Certificazione aziendale #{index} senza nome.", True))
        lower_label = label.lower()
        if lower_label and lower_label in cert_labels:
            issues.append(_issue("warning", "COMPANY_CERT_DUPLICATE", f"Certificazione aziendale duplicata: {label}."))
        if lower_label:
            cert_labels.add(lower_label)

    master_prof_certs = {
        cert.lower()
        for cert in (getattr(master_data, "prof_certs", None) or [])
        if isinstance(cert, str)
    }
    req_ids = set()
    for index, req in enumerate(reqs, start=1):
        req_id = (req.get("id") or "").strip()
        label = (req.get("label") or "").strip()
        display = label or req_id or f"#{index}"

        if not req_id:
            issues.append(_issue("error", "REQ_ID_MISSING", f"Requisito {display} senza identificativo.", True))
        lower_req_id = req_id.lower()
        if lower_req_id and lower_req_id in req_ids:
            issues.append(_issue("error", "REQ_ID_DUPLICATE", f"Identificativo requisito duplicato: {req_id}.", True))
        if lower_req_id:
            req_ids.add(lower_req_id)

        if req.get("type") not in VALID_REQ_TYPES:
            issues.append(_issue("error", "REQ_TYPE_INVALID", f"Requisito {display} con tipo non valido.", True))
        if _num(req.get("gara_weight")) <= 0:
            issues.append(_issue("warning", "REQ_WEIGHT_MISSING", f"Requisito {display} senza peso gara."))
        if _num(req.get("max_points")) <= 0:
            issues.append(_issue("warning", "REQ_MAX_POINTS_MISSING", f"Requisito {display} senza punteggio grezzo massimo."))

        if req.get("type") == "resource":
            if _num(req.get("prof_C")) > _num(req.get("prof_R")):
                issues.append(_issue("error", "REQ_C_GT_R", f"Requisito {display}: C non può superare R.", True))
            selected_certs = req.get("selected_prof_certs") or []
            if not selected_certs:
                issues.append(_issue("warning", "REQ_NO_PROF_CERTS", f"Requisito risorsa {display} senza certificazioni professionali selezionate."))
            for cert in selected_certs:
                if master_prof_certs and cert.lower() not in master_prof_certs:
                    issues.append(_issue("warning", "REQ_CERT_NOT_IN_MASTER", f"Certificazione '{cert}' non presente nei Master Data."))

    weighted_tech = sum(_num(cert.get("gara_weight")) for cert in company_certs)
    weighted_tech += sum(_num(req.get("gara_weight")) for req in reqs)
    max_tech = _num(lot.get("max_tech_score"))
    if max_tech > 0 and abs(weighted_tech - max_tech) > 0.05:
        issues.append(_issue("warning", "TECH_WEIGHT_MISMATCH", f"Somma pesi tecnici {weighted_tech:.2f} diversa dal massimo tecnico {max_tech:.2f}."))
    if weighted_tech > 100:
        issues.append(_issue("error", "TECH_WEIGHT_GT_100", "La somma dei pesi tecnici supera 100.", True))

    if lot.get("rti_enabled"):
        active_companies = ["Lutech", *(lot.get("rti_companies") or [])]
        quotas = lot.get("rti_quotas") or {}
        total_quota = sum(_num(quotas.get(company)) for company in active_companies)
        if abs(total_quota - 100) > 0.05:
            issues.append(_issue("error", "RTI_QUOTA_INVALID", f"Quote RTI non bilanciate: totale {total_quota:.2f}%.", True))

    return issues


def blocking_issues(issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [issue for issue in issues if issue.get("blocking")]
