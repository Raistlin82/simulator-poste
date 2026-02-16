# Business Plan Database Migrations

## Problema Corrente

L'errore 500 al caricamento del Business Plan è causato da colonne mancanti nel database remoto.

Le seguenti colonne sono state aggiunte al modello ma non esistono ancora nel database remoto:
- `governance_mode`
- `governance_fte_periods`
- `governance_apply_reuse`
- `start_year` (migrazione precedente)
- `start_month` (migrazione precedente)

## Soluzione: Eseguire le Migrazioni

### Metodo 1: Script Automatico (Raccomandato)

Eseguire lo script di migrazione sul server remoto:

```bash
# Nel backend directory
python run_migrations.py
```

Lo script:
- ✅ Controlla quali colonne esistono già
- ✅ Aggiunge solo le colonne mancanti
- ✅ Non sovrascrive dati esistenti
- ✅ È idempotente (può essere eseguito più volte senza problemi)

### Metodo 2: SSH al Server Kyma

Se hai accesso SSH al pod Kyma:

```bash
# 1. Ottieni il nome del pod backend
kubectl get pods -n <namespace>

# 2. Accedi al pod
kubectl exec -it <backend-pod-name> -n <namespace> -- /bin/sh

# 3. Naviga alla directory backend
cd /app/backend

# 4. Esegui le migrazioni
python run_migrations.py
```

### Metodo 3: Deploy Automatico

Se il deployment usa Docker/Kubernetes, aggiungi al container startup script:

```bash
# In Dockerfile o startup script
python run_migrations.py
python main.py  # o il tuo comando di avvio
```

### Metodo 4: Manuale via SQL

Se necessario, puoi eseguire manualmente le query SQL:

```sql
-- Controlla se le colonne esistono
PRAGMA table_info(business_plans);

-- Aggiungi colonne mancanti
ALTER TABLE business_plans ADD COLUMN start_year INTEGER DEFAULT NULL;
ALTER TABLE business_plans ADD COLUMN start_month INTEGER DEFAULT NULL;
ALTER TABLE business_plans ADD COLUMN governance_mode TEXT DEFAULT "percentage";
ALTER TABLE business_plans ADD COLUMN governance_fte_periods TEXT DEFAULT "[]";
ALTER TABLE business_plans ADD COLUMN governance_apply_reuse INTEGER DEFAULT 0;
```

## Verifica Post-Migrazione

Dopo aver eseguito le migrazioni, verifica:

```bash
# Controlla le colonne della tabella
sqlite3 simulator_poste.db "PRAGMA table_info(business_plans);"

# Verifica che tutte le colonne siano presenti
# Dovresti vedere:
# - governance_mode (TEXT)
# - governance_fte_periods (TEXT)
# - governance_apply_reuse (INTEGER)
# - start_year (INTEGER)
# - start_month (INTEGER)
```

## Log dello Script

Lo script stampa output dettagliato:

```
============================================================
Business Plan Database Migrations
============================================================
📊 Checking database: /path/to/simulator_poste.db
  ➕ Adding column: governance_mode (Modalità calcolo governance)
  ➕ Adding column: governance_fte_periods (Time slices per governance FTE)
  ➕ Adding column: governance_apply_reuse (Flag: applicare riuso alla governance)
✅ Migration completed: added 3 column(s)
============================================================
```

Se le colonne esistono già:

```
✅ All migrations already applied, database is up to date
```

## File Coinvolti

- `run_migrations.py` - Script automatico di migrazione
- `migrate_governance_enhancements.py` - Migrazione specifica governance (deprecato, usa run_migrations.py)
- `migrate_bp_dates.py` - Migrazione specifica date (deprecato, usa run_migrations.py)

## Note Importanti

1. **Sicurezza**: Lo script NON sovrascrive dati esistenti
2. **Idempotenza**: Può essere eseguito più volte senza problemi
3. **Transazioni**: Usa transazioni SQLite per atomicità
4. **Backup**: Consigliato fare backup del DB prima della migrazione (opzionale ma raccomandato)

## Troubleshooting

### Errore: "database is locked"
- Il database è in uso da un altro processo
- Ferma il backend, esegui la migrazione, riavvia il backend

### Errore: "permission denied"
- Verifica i permessi del file database
- Potrebbe essere necessario eseguire con sudo (sconsigliato) o come utente corretto

### Errore: "column already exists"
- Non dovrebbe accadere (lo script controlla prima)
- Se accade, il database è parzialmente migrato - riesegui lo script

## Deployment Futuro

Per deployment futuri, considera:

1. **Alembic**: Migrazioni database con versioning
2. **Startup Hook**: Esegui migrazioni automaticamente all'avvio
3. **CI/CD**: Integra le migrazioni nel pipeline di deployment
