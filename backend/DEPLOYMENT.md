# Backend Deployment Guide

## 🚀 Automatic Database Migrations

Il backend ora esegue **automaticamente le migrazioni del database** all'avvio.

### Come Funziona

Quando il container backend viene avviato:

1. ✅ **Esegue le migrazioni** (`run_migrations.py`)
2. ✅ **Verifica il successo** (exit se fallisce)
3. ✅ **Avvia Gunicorn** (solo se migrazioni OK)

### File Coinvolti

```
backend/
├── startup.sh              # Script di avvio (entry point)
├── run_migrations.py       # Script migrazioni automatiche
├── Dockerfile              # Configurazione container
└── DEPLOYMENT.md          # Questa guida
```

### Startup Flow

```bash
Container Start
    │
    ├──> startup.sh
    │     │
    │     ├──> run_migrations.py
    │     │      │
    │     │      ├──> Verifica colonne esistenti
    │     │      ├──> Aggiunge colonne mancanti
    │     │      └──> ✅ Success / ❌ Exit 1
    │     │
    │     └──> gunicorn (solo se migrations OK)
    │           │
    │           └──> main:app (FastAPI)
```

### Log di Avvio

Al deployment vedrai:

```
================================================
🚀 Starting Backend Application
================================================
📊 Running database migrations...
============================================================
Business Plan Database Migrations
============================================================
📊 Checking database: /app/simulator_poste.db
  ➕ Adding column: governance_mode (Modalità calcolo governance)
  ➕ Adding column: governance_fte_periods (Time slices per governance FTE)
  ➕ Adding column: governance_apply_reuse (Flag: applicare riuso alla governance)
✅ Migration completed: added 3 column(s)
============================================================
✅ Migrations completed successfully

🌐 Starting Gunicorn server...
================================================
[2024-XX-XX 12:00:00] [INFO] Starting gunicorn 21.2.0
[2024-XX-XX 12:00:00] [INFO] Listening at: http://0.0.0.0:8000 (1)
[2024-XX-XX 12:00:00] [INFO] Using worker: uvicorn.workers.UvicornWorker
```

Se le migrazioni sono già applicate:

```
📊 Running database migrations...
============================================================
Business Plan Database Migrations
============================================================
📊 Checking database: /app/simulator_poste.db
✅ All migrations already applied, database is up to date
============================================================
✅ Migrations completed successfully

🌐 Starting Gunicorn server...
```

### Deployment su Kyma

#### Metodo 1: Deploy via Git (Raccomandato)

```bash
# 1. Fai push delle modifiche
git push origin main

# 2. Il deployment automatico su Kyma rebuilda il container
# 3. All'avvio, le migrazioni vengono eseguite automaticamente
```

#### Metodo 2: Build Locale e Push

```bash
# 1. Build dell'immagine
docker build -t simulator-poste-backend:latest ./backend

# 2. Tag per registry
docker tag simulator-poste-backend:latest <your-registry>/simulator-poste-backend:latest

# 3. Push al registry
docker push <your-registry>/simulator-poste-backend:latest

# 4. Deploy su Kyma (automatico o manuale)
```

#### Metodo 3: kubectl apply

```bash
# Se usi Kubernetes deployment diretto
kubectl rollout restart deployment/backend -n <namespace>
```

### Verifica Post-Deploy

Dopo il deployment, verifica che tutto funzioni:

```bash
# 1. Controlla i logs del pod
kubectl logs -f <backend-pod-name> -n <namespace>

# Dovresti vedere:
# ✅ Migrations completed successfully
# 🌐 Starting Gunicorn server...

# 2. Verifica health check
curl https://your-backend-url/health/ready

# 3. Test Business Plan endpoint
curl https://your-backend-url/api/business-plan/<lot_key>
```

### Troubleshooting

#### Errore: "Migration failed"

```bash
# Controlla i log completi
kubectl logs <backend-pod-name> -n <namespace>

# Possibili cause:
# - Permessi database insufficienti
# - Database corrotto
# - Schema incompatibile
```

**Soluzione:**
```bash
# Accedi al pod
kubectl exec -it <backend-pod-name> -n <namespace> -- /bin/sh

# Verifica permessi database
ls -la simulator_poste.db

# Verifica schema
sqlite3 simulator_poste.db "PRAGMA table_info(business_plans);"

# Esegui manualmente le migrazioni
python run_migrations.py
```

#### Container in CrashLoopBackOff

```bash
# Verifica i log
kubectl describe pod <backend-pod-name> -n <namespace>
kubectl logs <backend-pod-name> -n <namespace> --previous
```

**Possibili cause:**
- Migration script fallisce
- startup.sh non eseguibile
- Dipendenze mancanti

**Soluzione:**
```bash
# Verifica che startup.sh sia eseguibile nel container
kubectl exec -it <backend-pod-name> -n <namespace> -- ls -la startup.sh

# Se non eseguibile, rebuilda l'immagine
# Il Dockerfile include: RUN chmod +x startup.sh
```

#### Database Locked

```bash
# Errore: "database is locked"
# Causa: Multiple workers che scrivono simultaneamente
```

**Soluzione:**
Il Dockerfile usa già `-w 1` (single worker) per evitare race conditions con SQLite.

Se persiste:
```bash
# Verifica non ci siano processi bloccanti
kubectl exec -it <backend-pod-name> -n <namespace> -- /bin/sh
ps aux | grep python
fuser simulator_poste.db  # Se disponibile
```

### Rollback

Se il nuovo deployment causa problemi:

```bash
# 1. Rollback al deployment precedente
kubectl rollout undo deployment/backend -n <namespace>

# 2. Verifica status
kubectl rollout status deployment/backend -n <namespace>

# 3. Controlla la versione attiva
kubectl get deployment backend -n <namespace> -o yaml | grep image:
```

### Best Practices

1. **Testing Locale**
   ```bash
   # Testa prima in locale con docker-compose
   docker-compose up --build backend

   # Verifica che le migrazioni funzionino
   docker-compose logs backend | grep "Migration"
   ```

2. **Staging First**
   ```bash
   # Deploy prima su staging/dev
   # Verifica che tutto funzioni
   # Poi deploy su production
   ```

3. **Database Backup**
   ```bash
   # Fai backup del database prima di deploy importanti
   kubectl cp <pod>:/app/simulator_poste.db ./backup-$(date +%Y%m%d).db
   ```

4. **Health Checks**
   ```yaml
   # Il docker-compose include già health check
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:8000/health/ready"]
     interval: 30s
     timeout: 10s
     retries: 3
     start_period: 40s  # Tempo extra per migrazioni
   ```

### Monitoring

```bash
# 1. Watch dei pods
kubectl get pods -n <namespace> -w

# 2. Stream logs in real-time
kubectl logs -f deployment/backend -n <namespace>

# 3. Eventi del deployment
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### Migrazioni Future

Per aggiungere nuove migrazioni in futuro:

1. **Modifica il database model** in `models.py`
2. **Aggiorna lo schema** in `schemas.py`
3. **Aggiorna CRUD** in `crud.py`
4. **Aggiungi migrazione** in `run_migrations.py`:
   ```python
   migrations.append((
       'business_plans',
       'new_column_name',
       'TEXT DEFAULT "default_value"',
       'Column description'
   ))
   ```
5. **Testa localmente** con `python run_migrations.py`
6. **Commit e push** - il deploy automatico farà il resto!

### Variabili d'Ambiente

Il migration script supporta:

```bash
# Specifica path custom del database
export DB_PATH=/custom/path/to/simulator_poste.db
python run_migrations.py
```

Nel container, usa il default `/app/simulator_poste.db`.

### Sicurezza

- ✅ Script eseguito come user `appuser` (non root)
- ✅ Permessi database verificati prima dell'esecuzione
- ✅ Transazioni SQLite per atomicità
- ✅ Idempotenza garantita (safe multi-run)
- ✅ Exit codes appropriati (0=success, 1=error)

---

## 📞 Support

Per problemi con il deployment:

1. Controlla i logs: `kubectl logs <pod>`
2. Verifica health: `curl /health/ready`
3. Esegui manualmente: `kubectl exec -it <pod> -- python run_migrations.py`
4. Consulta MIGRATION_INSTRUCTIONS.md per dettagli tecnici

## 📝 Changelog

- **2024-XX-XX**: Aggiunto sistema automatico di migrazioni
- **2024-XX-XX**: Integrato startup.sh come entrypoint
- **2024-XX-XX**: Aggiunte migrazioni governance enhancements
