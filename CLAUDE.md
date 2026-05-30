# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Enterprise system for simulating Italian public tender (gara d'appalto) evaluation, multi-lotto. It computes technical/economic/professional scores, runs Monte Carlo win-probability analysis, builds a full cost/margin **Business Plan**, verifies certifications via OCR, and exports PDF/Excel reports. **The domain language is Italian** — commits, comments, UI strings, and many identifiers are in Italian (lotto, gara, capitolato, sconto, margine, raggruppamento). Match this when writing user-facing text or domain code.

Two tiers: **FastAPI backend** (`backend/`, Python 3.12+) and **React 19 + Vite frontend** (`frontend/`). They talk over a REST API; in dev the frontend proxies `/api` → `localhost:8000`.

## Commands

Run from the repo root unless noted. There is no Makefile/task runner — use these directly.

```bash
# Backend dev (auto-reload on :8000, seeds DB on startup)
./start-backend.sh                 # creates venv, installs deps, runs uvicorn
# or manually:
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend dev (Vite HMR on :5173)
./start-frontend.sh                # npm install + npm run dev
cd frontend && npm run dev

# Full stack via Docker (frontend :5173, backend :8000, swagger /docs)
./start-all.sh                     # docker-compose build + up; writes a default .env

# Lint (frontend only — no backend linter configured)
cd frontend && npm run lint        # eslint

# Build frontend for production
cd frontend && npm run build
```

### Tests

```bash
# Backend (pytest) — install test deps first
cd backend && pip install -r requirements-test.txt
pytest -v                          # all: test_main, test_db, test_gara_weight, test_reference_bonus
pytest test_main.py::TestEconomicScore -v          # single class
pytest test_main.py::TestEconomicScore::test_economic_score_best_price -v   # single test
pytest --cov=. --cov-report=html   # coverage
```

Frontend has `vitest`, `@testing-library/react`, and `@playwright/test` installed, but **no `test` script in package.json and no test files yet** — there is no working frontend test command to run.

## Backend architecture

- **`main.py` is a ~3600-line monolith** holding most endpoints and request/response logic. Routes are registered on **three `APIRouter`s**, not directly on `app`:
  - `api_router` (`prefix="/api"`) — config, calculate, simulate, monte-carlo, optimize-discount, master-data, cert verification, vendor configs, exports.
  - `bp_router` (`prefix="/api/business-plan"`) — Business Plan CRUD, `/calculate`, `/scenarios`, `/find-discount`, import/export.
  - `practice_router` (`prefix="/api/practices"`).
  - Only `/health*` and `/metrics` are on `@app` directly. All three routers are `include_router`'d at the bottom of the file. When adding an endpoint, pick the right router — searching for `@app.post` will miss almost everything.
- **Business logic is extracted into `backend/services/`** for testability: `scoring_service.py` (economic/professional formulas), `business_plan_service.py` (the cost/margin engine — a documented 5-step formula: volume adjustments → reuse factor → team cost → catalog cost → governance cost → margin), `cert_verification_service.py` (OCR + LLM cert matching), `excel_config_service.py` / `excel_bp_import_service.py` (Excel import/export). `main.py` keeps thin wrapper functions (e.g. `calculate_economic_score`, `calculate_prof_score`) that delegate to `ScoringService` — **`test_main.py` imports these wrappers from `main`**, so keep them in sync with the service.
- **Persistence: SQLAlchemy ORM + SQLite by default** (`sqlite:///./simulator_poste.db`). `DATABASE_URL` env var overrides it; `psycopg2-binary` is bundled for Postgres in production. Models: `LotConfigModel`, `MasterDataModel`, `VendorConfigModel`, `OCRSettingsModel`, `PracticeModel`, `BusinessPlanModel` (`models.py`).
- **Seeding & JSON-as-source-of-truth**: on startup the `lifespan` handler calls `crud.seed_initial_data` / `seed_practices`, which load `backend/lot_configs.json` and `backend/master_data.json`. These JSON files are **read on first seed AND written back** when master data is updated via the API (`crud.update_master_data` re-syncs `master_data.json`). Treat them as live config, not fixtures.
- **Manual migrations**: `run_migrations()` runs *before* `Base.metadata.create_all()` because `create_all` never adds columns to existing tables. It uses `inspect(engine)` to ALTER-add missing columns. Standalone `migrate_*.py` scripts and `run_migrations.py` exist for larger schema changes. **When adding a column to an existing model, add a corresponding migration** — `create_all` alone won't apply it to existing DBs.
- **Auth: `OIDCMiddleware`** (`auth.py`) validates JWTs from SAP IAS (Identity Authentication Service) against the JWKS, with manual issuer/audience checks (`azp` fallback, since IAS puts client_id there). **Dev-mode bypass**: if `OIDC_CLIENT_ID` is unset, auth is skipped and a `dev-user` is injected — *unless* `ENVIRONMENT=production`, which makes it fail fast with 503. `PUBLIC_PATHS` (`/health*`, `/metrics`, `/docs`, `/openapi.json`, `/redoc`) skip auth.

## Frontend architecture

- **No router, no Redux.** Navigation is a `view` string in `AppContent` state (`dashboard` | `config` | `master` | `certs` | `businessPlan`); the only URL handling is detecting `/callback` for the OIDC redirect. State lives in nested React Contexts. Provider order in `App.jsx` (outer → inner):
  `ErrorBoundary → AuthProvider → ProtectedRoute → ToastProvider → ConfigProvider → SimulationProvider → AppContent`.
  `BusinessPlanProvider` wraps **only** the Business Plan page, not the whole app.
- **Feature-folder layout** under `src/features/`: `config/`, `simulation/`, `business-plan/`, `reports/` — each with its own `context/` and `components/`. Shared primitives are in `src/shared/` and `src/components/ui/` (Radix + Tailwind, shadcn-style). Older top-level components (`Dashboard`, `ConfigPage`, `TechEvaluator`, `MasterDataConfig`, `CertVerificationPage`, `Sidebar`) live in `src/components/`.
- **Data fetching**: an axios request interceptor injects `Authorization: Bearer <token>` from `useAuth().getAccessToken()`. Base URL comes from `src/utils/api.js` → `API_URL` (`/api` via Vite proxy in dev; `VITE_API_URL` in prod, auto-appending `/api`).
- **Auto-save model**: simulation state (discounts, tech inputs, certs) auto-saves to the backend with a **1s debounce**, guarded against saving during lot-switch/state-load races (`isLoadingState` ref, lot re-check after debounce). The top-bar **Save** button (`handleUnifiedSave`) saves simulation state + config + (if open) the Business Plan together; BP registers its save fn via the `bpSaveTrigger` singleton.
- **Frontend dev auth bypass** mirrors the backend: `AuthContext` checks `isOIDCConfigured()` and, when OIDC env vars are absent, sets a mock `dev-user` with `access_token: 'dev-token'` instead of running the OIDC flow.
- **i18n**: `react-i18next`, Italian (`locales/it.json`) is primary, `en.json` secondary. Dark mode is currently force-disabled (light theme hard-set in `AppContent`).

## Environment

Backend env (`.env` at root, see `.env.example`): `ENVIRONMENT` (development|staging|production), `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_AUDIENCE`, `FRONTEND_URL` (CORS), `DATABASE_URL`, `LOG_LEVEL`, and AI keys (`GOOGLE_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`) for the OCR/chat features. Frontend env (`frontend/.env`): `VITE_API_URL`, `VITE_OIDC_*`. Leaving OIDC vars unset on **both** sides is the intended way to run fully unauthenticated locally.

## Deployment

Kubernetes/Kyma manifests in `k8s/` (SAP BTP), `docker-compose.yml` + `start-prod.sh` for Docker, `render.yaml.disabled` for Render. Deployment notes: `LOCAL_DEPLOYMENT.md`, `RENDER_DEPLOYMENT.md`, `docs/KYMA_DEPLOYMENT.md`, `backend/DEPLOYMENT.md`. Further docs: `docs/api.md`, `docs/technical.md`, `docs/user-guide.md`.
