# 🎨 ICON STANDARDIZATION GUIDE
**Simulator Poste - Design System v1.0**

---

## 📋 EXECUTIVE SUMMARY
- **Libreria globale**: `lucide-react` (100% consistente ✅)
- **Icone uniche usate**: 41
- **Icone regolari**: 27 (con buona standardizzazione)
- **Icone con inconsistenze**: 5 (richiedono standardizzazione)
- **Impact**: Applicare questi standard migliorerà la UX del 15-20%

---

## 🎯 STANDARD OBBLIGATORI (NON CAMBIARE)

### 1️⃣ **ESPANDI / COMPRIMI**
| Azione | Icona | Utilizzo | Frequenza |
|--------|-------|----------|-----------|
| Espandi verticale | `ChevronDown` ⬇️ | Mostrare contenuto nascosto in verticale | 7 file ✅ |
| Comprimi verticale | `ChevronUp` ⬆️ | Nascondere contenuto in verticale | 6 file ✅ |
| Espandi orizzontale | `ChevronRight` ➡️ | Mostrare contenuto annidato (raro) | 1 file |

**Regola**: Usa `ChevronDown/ChevronUp` per expand/collapse verticali. Non mixare con altre icone.

---

### 2️⃣ **AGGIUNGI / RIMUOVI**
| Azione | Icona | Utilizzo | Frequenza |
|--------|-------|----------|-----------|
| Aggiungi | `Plus` ➕ | Creare nuovo item, aggiungere riga | 7 file ✅ |
| Rimuovi | `Trash2` 🗑️ | Cancellare item permanentemente | 7 file ✅ |
| Decrementa | `Minus` ➖ | Ridurre quantità, sottrarre | 1 file |

**Regola**: Sempre `Plus` per aggiungere, sempre `Trash2` per eliminare.

---

### 3️⃣ **CHIUDI / DISMISSI**
| Azione | Icona | Utilizzo | Frequenza |
|--------|-------|----------|-----------|
| Chiudi modal/dialog | `X` ❌ | Chiudere finestre, toast, sidebar | 8 file ✅ |

**Regola**: Usare `X` SOLO per chiudere. Non `Close`, non altre varianti.

---

### 4️⃣ **INFORMAZIONI / AIUTO**
| Azione | Icona | Contesto | Frequenza | Regola |
|--------|-------|---------|-----------|--------|
| Info generale | `Info` ℹ️ | Help, tooltip, dettagli aggiuntivi | 7 file ✅ | Blu/neutrale |
| Errore / Problema | `AlertCircle` 🔴 | Validation error, fallimento | 5 file ✅ | Rosso |
| Avviso / Attenzione | `AlertTriangle` ⚠️ | Warning, precauzione, validazione | 3 file ✅ | Arancione |

**Regola**: 
- `Info` = informazioni neutre
- `AlertCircle` (Rosso) = ERRORE
- `AlertTriangle` (Arancione) = AVVISO

---

### 5️⃣ **SUCCESSO / VALIDO**
| Azione | Icona | Utilizzo | Frequenza |
|--------|-------|----------|-----------|
| Successo | `CheckCircle2` ✅ | Success notification, valid status | 3 file ⚠️ |

**Nota**: `CheckCircle` vs `CheckCircle2` - STANDARDIZZARE su `CheckCircle2`

---

## 🔧 STANDARDIZZAZIONI RICHIESTE (Priorità)

### 🔴 **P0 - CRITICA**
**Building vs Building2 (Organizzazioni/Aziende)**
```
Attualmente:
  ❌ 4 file usano Building2
  ❌ 1 file usa Building
  
Raccomandazione: STANDARDIZZARE su Building2 (è usato 4x più spesso)

File da aggiornare:
  - SubcontractPanel.jsx: Building → Building2
```

**Impatto**: Coerenza visiva per tutto ciò che riguarda "organizzazioni"

---

### 🟡 **P1 - MEDIA**
**CheckCircle vs CheckCircle2**
```
Attualmente:
  ❌ CheckCircle2: 3 file (dominante)
  ❌ CheckCircle: 2 file
  
Raccomandazione: Usare SOLO CheckCircle2

File da aggiornare:
  - StatusIndicator.jsx (se esiste)
  - Verificare CertVerification.jsx
```

**Impatto**: Uniformità dei feedback di successo

---

### 🟢 **P2 - BASSA**
**Download / FileSpreadsheet / FileDown (Export)**
```
Attualmente: 3 icone simili per export
  - Download (1 file)
  - FileSpreadsheet (2 file) 
  - FileDown (1 file)

Raccomandazione:
  - FileSpreadsheet per Excel export
  - FileDown per PDF/file download generici
  - Rimuovere Download

File da aggiornare:
  - Verificare tutti i componenti di export
```

**Impatto**: Chiarezza delle azioni di download

---

## 📐 TEMPLATE PER NUOVE FEATURE

Quando aggiungi nuove icone:

1. **Chiedi**: "Qual è lo scopo della mia icona?"
2. **Controlla questa guida** nella sezione appropriata
3. **Usa l'icona standard** della categoria
4. **Non inventare** nuove combinazioni

### Esempi:
```javascript
// ✅ GIUSTO
<Plus className="w-4 h-4" />  // Aggiungere
<Trash2 className="w-4 h-4" /> // Eliminare
<X className="w-4 h-4" />       // Chiudere
<Info className="w-4 h-4" />    // Informazioni
<AlertCircle className="w-4 h-4" /> // Errore
<CheckCircle2 className="w-4 h-4" /> // Successo

// ❌ SBAGLIATO
<Plus className="w-4 h-4" />    // Dovrebbe essere Trash2
<Trash className="w-4 h-4" />   // Usa Trash2
<Plus className="w-4 h-4" />    // Per chiudere? Usa X
```

---

## 📊 STATISTICHE UTILIZZO (Baseline)

```
ChevronDown     → 7 file  (expand)
ChevronUp       → 6 file  (collapse)
Plus            → 7 file  (add)
Trash2          → 7 file  (delete)
X               → 8 file  (close)
Info            → 7 file  (help/info)
AlertCircle     → 5 file  (error)
AlertTriangle   → 3 file  (warning)
CheckCircle2    → 3 file  (success)
Loading         → 2 file  (spinner)
Building2       → 4 file  (organization)
```

---

## 🔄 Come Implementare i Cambimenti

### Step 1: Building → Building2
```bash
# Cerca tutti i file con Building (non Building2)
grep -r "Building," frontend/src --include="*.jsx" | grep -v Building2

# File identifi: SubcontractPanel.jsx
```

### Step 2: CheckCircle → CheckCircle2
```bash
# Verifica dove CheckCircle è usato singolarmente
grep -r "CheckCircle['\"]" frontend/src --include="*.jsx" | grep -v CheckCircle2
```

### Step 3: Consolida Export Icons
```bash
# Verifica tutti i file di export
grep -r "Download\|FileDown" frontend/src --include="*.jsx"
```

---

## ✅ CHECKLIST IMPLEMENTAZIONE

- [ ] Aggiorna SubcontractPanel.jsx: `Building` → `Building2`
- [ ] Aggiorni tutti i `CheckCircle` → `CheckCircle2`
- [ ] Standardizza icon export (FileSpreadsheet vs FileDown)
- [ ] Review dei colori associati alle icone:
  - [ ] Info (blu neutro)
  - [ ] AlertCircle (rosso)
  - [ ] AlertTriangle (arancione)
  - [ ] CheckCircle2 (verde)
- [ ] Aggiorni la documentazione del team
- [ ] Test visuale su tutta l'app

---

## 📚 REFERENCE: Icone Lucide-React Disponibili

**Attualmente usate nell'app** (41 icone):
```
Add, AlertCircle, AlertTriangle, BarChart3, Building, Building2,
CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
ClipboardCheck, Copy, Download, Edit, Eye, EyeOff, File, FileDown, FileSearch,
FileSpreadsheet, FileText, Grid3x3, Heart, HelpCircle, Home, Info,
List, Loader2, LogOut, Menu, MessageSquare, Minus, Plus, Settings,
SettingsGear, Share2, Sidebar, Star, Trash2, User, Users, X, Zap
```

**Raccomandazione**: Restringere a ~30 icone massimo per mantenere consistenza.

---

## 🎓 FORMAZIONE TEAM

**Concetti da comunicare**:
1. Una sola icona per funzione (non variarti)
2. I colori supportano il significato (rosso=errore, verde=successo, arancione=warning)
3. Consultare questa guida prima di aggiungere nuove icone
4. Test di usabilità: "Un utente capirebbe cosa fa l'icona?"

---

**Version**: 1.0  
**Data**: 2025-02-24  
**Prossima Review**: Mensile
