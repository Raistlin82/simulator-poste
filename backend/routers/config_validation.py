from typing import Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas
from database import SessionLocal
from services.lot_validation_service import blocking_issues, validate_lot_config

router = APIRouter(prefix="/api/config", tags=["config-validation"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/validate")
def validate_config_payload(
    config_payload: Dict[str, schemas.LotConfig],
    db: Session = Depends(get_db),
):
    master_data = crud.get_master_data(db)
    result = {}
    for lot_name, lot_data in config_payload.items():
        issues = validate_lot_config(lot_data, master_data)
        result[lot_name] = {
            "valid": not blocking_issues(issues),
            "issues": issues,
        }
    return result
