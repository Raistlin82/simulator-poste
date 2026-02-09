# Design: Deployment su SAP BTP Cloud Foundry

**Data**: 2025-02-09
**Stato**: Approvato
**Branch**: `feature/btp-cloud-foundry` (da creare)

## Obiettivo

Deployare l'applicazione simulator-poste su SAP BTP Cloud Foundry minimizzando gli impatti sul codice esistente, mantenendo l'implementazione Render.com funzionante in parallelo.

## Decisioni Chiave

| Aspetto | Decisione | Motivazione |
|---------|-----------|-------------|
| Database | PostgreSQL (BTP managed) | SQLAlchemy già supportato, CF è stateless |
| Frontend | Staticfile Buildpack | Semplice, nativo CF, no dipendenze SAP |
| Auth | OIDC diretto con SAP IAS | Zero modifiche al codice auth esistente |
| Ambiente | CF org/space esistente | Già disponibile |

## Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                    SAP BTP Cloud Foundry                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │   Frontend App   │         │      Backend App         │  │
│  │  (staticfile)    │  ───►   │      (python)            │  │
│  │                  │  /api   │                          │  │
│  │  - Vite build    │         │  - FastAPI               │  │
│  │  - nginx proxy   │         │  - Gunicorn              │  │
│  └──────────────────┘         └───────────┬──────────────┘  │
│                                           │                  │
│                               ┌───────────▼──────────────┐  │
│                               │   PostgreSQL Service     │  │
│                               │   (SAP BTP managed)      │  │
│                               └──────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │      SAP IAS         │
              │  (OIDC Provider)     │
              │  asojzafbi.accounts  │
              │  .ondemand.com       │
              └──────────────────────┘
```

## File da Creare

### 1. `mta.yaml` (root)

```yaml
_schema-version: "3.1"
ID: simulator-poste
version: 1.0.0

modules:
  # Backend Python
  - name: simulator-poste-backend
    type: python
    path: backend
    parameters:
      memory: 256M
      disk-quota: 512M
    requires:
      - name: simulator-poste-db
    properties:
      ENVIRONMENT: production

  # Frontend Static
  - name: simulator-poste-frontend
    type: staticfile
    path: frontend
    parameters:
      memory: 64M
    build-parameters:
      builder: npm
      build-result: dist

resources:
  # PostgreSQL Service
  - name: simulator-poste-db
    type: org.cloudfoundry.managed-service
    parameters:
      service: postgresql-db
      service-plan: trial  # o "standard" per produzione
```

### 2. `frontend/Staticfile`

```
pushstate: enabled
```

### 3. `frontend/nginx.conf`

```nginx
location /api/ {
    proxy_pass https://simulator-poste-backend.cfapps.eu10.hana.ondemand.com/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. `backend/runtime.txt`

```
python-3.11.x
```

## File da Modificare

### 1. `backend/requirements.txt`

Aggiungere:
```
psycopg2-binary
```

### 2. `backend/database.py`

Aggiungere logica per VCAP_SERVICES:

```python
import os
import json

def get_database_url():
    """Get database URL from VCAP_SERVICES (BTP) or environment variable."""
    if "VCAP_SERVICES" in os.environ:
        # Running on BTP Cloud Foundry
        vcap = json.loads(os.environ["VCAP_SERVICES"])
        pg_creds = vcap["postgresql-db"][0]["credentials"]
        return pg_creds["uri"]
    else:
        # Local development or other platforms
        return os.getenv("DATABASE_URL", "sqlite:///./simulator_poste.db")

DATABASE_URL = get_database_url()
```

## Configurazione SAP IAS

Aggiungere alle Redirect URIs dell'applicazione OIDC esistente:

```
https://simulator-poste-frontend.cfapps.eu10.hana.ondemand.com/callback
https://simulator-poste-frontend.cfapps.eu10.hana.ondemand.com
```

Post-Logout Redirect URIs:
```
https://simulator-poste-frontend.cfapps.eu10.hana.ondemand.com
```

**Nota**: Gli URL Render.com esistenti rimangono configurati per funzionamento parallelo.

## Processo di Deployment

```bash
# 1. Build MTA archive
mbt build

# 2. Deploy to CF
cf deploy mta_archives/simulator-poste_1.0.0.mtar

# 3. Verifica
cf apps
```

## Impatto Totale

| Area | File Nuovi | File Modificati | Righe di Codice |
|------|-----------|-----------------|-----------------|
| Backend | 1 (`runtime.txt`) | 2 (`database.py`, `requirements.txt`) | ~15 righe |
| Frontend | 2 (`Staticfile`, `nginx.conf`) | 0 | ~20 righe |
| Root | 1 (`mta.yaml`) | 0 | ~40 righe |
| **Totale** | **4 file** | **2 file** | **~75 righe** |

## Checklist Implementazione

- [ ] Creare branch `feature/btp-cloud-foundry`
- [ ] Backend: Aggiungere `psycopg2-binary` a `requirements.txt`
- [ ] Backend: Creare `runtime.txt` con `python-3.11.x`
- [ ] Backend: Modificare `database.py` per VCAP_SERVICES
- [ ] Frontend: Creare `Staticfile`
- [ ] Frontend: Creare `nginx.conf` con proxy `/api`
- [ ] Root: Creare `mta.yaml`
- [ ] Build: `mbt build`
- [ ] Deploy: `cf deploy mta_archives/simulator-poste_*.mtar`
- [ ] IAS: Aggiungere redirect URIs per CF
- [ ] Test: Verificare login e funzionalità
- [ ] (Opzionale) Merge in main se tutto ok

## Note

- L'implementazione Render.com rimane intatta e funzionante
- Il `client_id` OIDC rimane invariato
- Nessuna modifica alla logica business, API, o autenticazione
