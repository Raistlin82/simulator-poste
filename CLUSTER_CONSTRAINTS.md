# Vincoli Cluster Poste - Tipi di Distribuzione

## Overview

Nella sezione "Realizzazione soluzione con componenti a catalogo" → "Vincoli Cluster Poste", è ora possibile definire il tipo di vincolo per ogni cluster, specificando se la distribuzione effettiva deve essere:

- **Uguaglianza (`=`)**: La distribuzione effettiva deve corrispondere al target (con tolleranza ±2%)
- **Minimo (`≥`)**: La distribuzione effettiva deve essere **almeno** pari al target
- **Massimo (`≤`)**: La distribuzione effettiva deve **non superare** il target

## Utilizzo

### Nell'Editor Catalog (CatalogEditorModal)

1. Apri un TOW di tipo **catalogo**
2. Vai alla tab **"Cluster"**
3. Per ogni cluster definito:
   - **Nome**: Identificativo del cluster
   - **Tipo (V.)**: Seleziona il tipo di vincolo:
     - `=` (equality): vincolo stringente
     - `≥` (minimum): distribuzione minima richiesta
     - `≤` (maximum): distribuzione massima consentita
   - **Percentuale**: Valore target
   - **Figure**: Aggiungi i profili Poste che appartengono a questo cluster

### Nella Distribuzione Effettiva

La tabella "Distribuzione Effettiva" mostra:

| Colonna | Descrizione |
|---------|------------|
| **V.** | Tipo di vincolo (=, ≥, ≤) |
| **% Req.** | Percentuale target definita |
| **FTE Target** | FTE corrispondenti alla percentuale |
| **% Att.** | Percentuale effettiva calcolata |
| **FTE Att.** | FTE effettivi |
| **Δ%** | Scarto tra effettivo e target |
| **Stato** | ✓ (soddisfatto) o ⚠ (violato) |

#### Validazione

- **`=` (equality)**: Soddisfatto se `|Δ%| ≤ 2%`
- **`≥` (minimum)**: Soddisfatto se `% Att. ≥ % Req.`
- **`≤` (maximum)**: Soddisfatto se `% Att. ≤ % Req.`

## Compatibilità

- I cluster creati prima di questa modifica hanno automaticamente `constraint_type = "equality"` (comportamento precedente)
- La modifica è **backward compatible**

## Esempi di Utilizzo

### Esempio 1: Allocazione esatta di figure senior
```
Cluster: "Senior Figure"
Tipo: = (equality)
Percentuale: 30%
Distribuzione effettiva: deve essere 28-32% (±2%)
```

### Esempio 2: Requisito minimo di esperienza
```
Cluster: "Governance"
Tipo: ≥ (minimum)
Percentuale: 20%
Distribuzione effettiva: deve essere almeno 20%
Accettabile: 20%, 25%, 30%, etc.
```

### Esempio 3: Limite massimo di outsourcing
```
Cluster: "Outsourcing"
Tipo: ≤ (maximum)
Percentuale: 40%
Distribuzione effettiva: non può superare il 40%
Accettabile: 10%, 25%, 40%
Non accettabile: 41%, 50%, etc.
```

## Implementazione Tecnica

### Backend (business_plan_service.py)

La funzione `_compute_cluster_distribution()` ora:
1. Legge il `constraint_type` da ogni cluster
2. Applica la logica di validazione corretta (`ok`)
3. Ritorna `constraint_type` nel risultato per il frontend

### Frontend

- **CatalogEditorModal**: Selector dropdown con tre opzioni
- **TowAnalysis/CostBreakdown**: Mostra il simbolo del vincolo (`=`, `≥`, `≤`)
- **BusinessPlanPage**: Applica la stessa logica di validazione in fase di calcolo

## Validazione nella UI

La distribuzione effettiva viene visualizzata con:
- ✅ **Verde** se il vincolo è soddisfatto
- ⚠️ **Rosso** se il vincolo è violato
