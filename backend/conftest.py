"""
Pytest configuration and shared fixtures.

Forces an isolated SQLite database for the whole test session so tests never
touch the developer's real `simulator_poste.db`. This MUST run before any app
module is imported, because `database.py` reads `DATABASE_URL` at import time.
"""
import os
import tempfile

# --- Test environment (set before importing app modules) -------------------
_TEST_DB = os.path.join(tempfile.gettempdir(), "simulator_poste_test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ.setdefault("ENVIRONMENT", "test")
# Run with the dev auth bypass (no OIDC) so endpoint tests don't need tokens.
# The bypass is fail-closed by default, so it must be explicitly opted into.
os.environ.pop("OIDC_CLIENT_ID", None)
os.environ["AUTH_DEV_BYPASS"] = "1"

# Start from a clean DB each session; tables are (re)created when `main` imports.
if os.path.exists(_TEST_DB):
    os.remove(_TEST_DB)

import pytest


@pytest.fixture(scope="session", autouse=True)
def _seeded_database():
    """Create the schema and seed reference data once per test session."""
    import main  # noqa: F401  -- import side effect: run_migrations() + create_all()
    import crud
    from database import SessionLocal

    db = SessionLocal()
    try:
        crud.seed_initial_data(db)
        try:
            crud.seed_practices(db)
        except Exception:
            # Practices are optional for most tests.
            pass
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture()
def db():
    """A SQLAlchemy session bound to the seeded test database."""
    from database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
