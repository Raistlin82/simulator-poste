"""
Tests that the database seeds reference/master data correctly.
(Replaces the previous print-only script.)
"""
import crud
import models


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


def test_build_profile_rates_maps_practice_profiles(db):
    """The shared helper maps 'practice_id:profile_id' -> daily_rate."""
    practice = models.PracticeModel(
        id="testprac_rates",
        label="Test Practice",
        profiles=[
            {"id": "dev_sr", "daily_rate": 480.0},
            {"id": "dev_jr", "daily_rate": 300.0},
        ],
    )
    db.add(practice)
    db.commit()
    try:
        rates = crud.build_profile_rates(db)
        assert rates["testprac_rates:dev_sr"] == 480.0
        assert rates["testprac_rates:dev_jr"] == 300.0
    finally:
        db.delete(practice)
        db.commit()
