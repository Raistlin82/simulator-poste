"""
Tests that the database seeds reference/master data correctly.
(Replaces the previous print-only script.)
"""
import crud


def test_master_data_is_seeded(db):
    master = crud.get_master_data(db)
    assert master is not None
    # prof_certs_resources maps cert -> resource count (int after migration).
    assert isinstance(master.prof_certs_resources, dict)


def test_lots_are_seeded(db):
    configs = crud.get_all_lot_configs(db) if hasattr(crud, "get_all_lot_configs") else None
    if configs is None:
        import models
        configs = db.query(models.LotConfigModel).all()
    names = {c.name for c in configs}
    assert {"Lotto 1", "Lotto 2", "Lotto 3"}.issubset(names)
