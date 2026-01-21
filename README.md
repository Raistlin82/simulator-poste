# Poste Tender Simulator

## Overview
Simulatore di valutazione tecnica ed economica per gare a lotti, completamente configurabile via file JSON e con frontend React.

## Struttura progetto
- **backend/**: FastAPI, logica scoring, API REST, PDF export
- **frontend/**: React 18+, Tailwind, UI dinamica, i18n
- **lot_configs.json**: configurazione lotti, requisiti, formule

## Avvio rapido
1. Crea e attiva un virtualenv Python 3.12+
2. Installa le dipendenze:
   ```sh
   pip install -r backend/requirements.txt
   ```
3. Avvia il backend:
   ```sh
   uvicorn backend.main:app --reload
   ```
4. Avvia il frontend:
   ```sh
   cd frontend
   npm install
   npm run dev
   ```

## Testing
- Esegui tutti i test automatici:
  ```sh
  pytest backend/test_main.py -v
  ```
- Test E2E e validazione scoring: vedi `test_integration.py`, `verify_scoring.py`

## Configurazione
- Tutti i lotti e requisiti sono definiti in `backend/lot_configs.json`.
- Le formule di scoring sono dinamiche e guidate da config.

## Qualità e refactoring
- Codice pulito, senza TODO/debug residui.
- Test automatici completi e superati.
- UI/UX validata.

## Autore
Gabriele Rendina
