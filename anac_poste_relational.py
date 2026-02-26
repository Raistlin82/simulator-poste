import json
import os
import sys
from pathlib import Path

def analyze_anac_relations(cig_input_path, agg_file, awardees_input_path):
    print("🚀 INIZIO ANALISI MULTI-FILE ANAC (LEFT JOIN RELAZIONALE CON FOLDER)")
    
    # ---------------------------------------------------------
    # IDENTIFICAZIONE FILE CIG DA SCANSIONARE
    # ---------------------------------------------------------
    cig_files = []
    c_path = Path(cig_input_path)
    if c_path.is_file():
        cig_files = [c_path]
        print(f"📁 1. CIG Master   : Singolo file ({c_path.name})")
    elif c_path.is_dir():
        cig_files = list(c_path.glob("*.json"))
        print(f"📁 1. CIG Master   : Cartella con {len(cig_files)} file JSON")
    else:
        print(f"❌ Errore: Il percorso CIG specificato '{cig_input_path}' non esiste.")
        return

    if not cig_files:
        print(f"❌ Nessun file JSON trovato nel percorso specificato per i CIG.")
        return

    if not os.path.exists(agg_file):
        print("❌ Errore: File Aggiudicazioni non trovato al path specificato.")
        return

    # ---------------------------------------------------------
    # IDENTIFICAZIONE FILE AGGIUDICATARI
    # ---------------------------------------------------------
    awardees_files = []
    a_path = Path(awardees_input_path)
    if a_path.is_file():
        awardees_files = [a_path]
        print(f"📁 2. Aggiudicaz.  : {Path(agg_file).name}")
        print(f"📁 3. Aggiudicatari: Singolo file ({a_path.name})\n")
    elif a_path.is_dir():
        awardees_files = list(a_path.glob("*.json"))
        print(f"📁 2. Aggiudicaz.  : {Path(agg_file).name}")
        print(f"📁 3. Aggiudicatari: Cartella con {len(awardees_files)} file JSON\n")
    else:
        print(f"❌ Errore: Il percorso Aggiudicatari '{awardees_input_path}' non esiste.")
        return

    if not awardees_files:
        print(f"❌ Nessun file JSON trovato nel percorso specificato per gli Aggiudicatari.")
        return

    # ---------------------------------------------------------
    # FASE 1: Ricerca Gare Poste in tutti i file CIG
    # ---------------------------------------------------------
    print(f"⏳ [Fase 1/3] Estrazione Gare Poste da {len(cig_files)} file CIG Master...")
    poste_cigs = {}  
    POSTE_VAT_CF = ["01114601006", "97103880585", "10500870967", "05824271004"] 
    
    file_processati = 0
    for cig_file in cig_files:
        file_processati += 1
        try:
            with open(cig_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if not line.strip(): continue
                    try:
                        record = json.loads(line)
                        buyer = str(record.get("denominazione_amministrazione_appaltante", "")).upper()
                        c_fisc = str(record.get("cf_amministrazione_appaltante", ""))
                        
                        if "POSTE" in buyer or "SDA" in buyer or c_fisc in POSTE_VAT_CF:
                            cig = record.get("cig")
                            esito = record.get("esito", record.get("stato", "N/D"))
                            if cig:
                                poste_cigs[cig] = {
                                    "buyer": buyer,
                                    "cf": c_fisc,
                                    "titolo": record.get("oggetto_gara", record.get("oggetto_lotto", "N/D")),
                                    "base_asta": record.get("importo_lotto", record.get("importo_complessivo_gara")),
                                    "esito": esito
                                }
                    except json.JSONDecodeError: pass
        except Exception as e:
            print(f"   ⚠️ Errore di lettura file {cig_file.name}: {e}")
            
    if not poste_cigs:
        print("\n❌ Nessuna gara di Poste trovata nell'intero set di file Master CIG. Analisi terminata.")
        return

    print(f"\n✅ FASE 1 COMPLETATA. Trovate {len(poste_cigs)} gare di Poste Italiane uniche. Procedo con le Join...\n")

    # ---------------------------------------------------------
    # FASE 2: Join con Dati Economici d'Aggiudicazione
    # ---------------------------------------------------------
    print("⏳ [Fase 2/3] Ricerca importi vincenti nel file Aggiudicazioni...")
    aggiudicazioni = {} 
    
    with open(agg_file, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            try:
                record = json.loads(line)
                cig = record.get("cig")
                if cig in poste_cigs:
                    id_agg = record.get("id_aggiudicazione")
                    if id_agg:
                        aggiudicazioni[str(id_agg)] = {
                            "cig": cig,
                            "importo_agg": record.get("importo_aggiudicazione"),
                            "data_add": record.get("data_aggiudicazione_definitiva", "N/D"),
                            "vincitori": [] # Array pronto per salvare le aziende vincitrici
                        }
            except: pass

    cigs_con_aggiudicazione = [v["cig"] for v in aggiudicazioni.values()]
    print(f"✅ Trovati {len(aggiudicazioni)} record economici per i CIG di Poste.\n")

    # ---------------------------------------------------------
    # FASE 3: Assegnazione Anagrafiche (Aggiudicatari) alle Gare
    # ---------------------------------------------------------
    print(f"⏳ [Fase 3/3] Ricerca nomi aziende vincitrici in {len(awardees_files)} file Aggiudicatari...\n")
    
    match_aziende = 0
    file_processati_agg = 0
    
    for aw_file in awardees_files:
        file_processati_agg += 1
        print(f"   -> Scansione {aw_file.name} ({file_processati_agg}/{len(awardees_files)})...")
        try:
            with open(aw_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if not line.strip(): continue
                    try:
                        record = json.loads(line)
                        id_agg = str(record.get("id_aggiudicazione"))
                        
                        # Se l'azienda ha vinto uno o più dei lotti già in RAM
                        if id_agg in aggiudicazioni:
                            match_aziende += 1
                            azienda_vincitrice = str(record.get("denominazione", "N/D")).upper()
                            if azienda_vincitrice not in aggiudicazioni[id_agg]["vincitori"]:
                                aggiudicazioni[id_agg]["vincitori"].append(azienda_vincitrice)
                    except: pass
        except Exception as e:
                print(f"   ⚠️ Errore di lettura file {aw_file.name}: {e}")

    print(f"✅ Trovati {match_aziende} abbinamenti azienda -> gara.")
    if match_aziende < len(aggiudicazioni):
        print(f"⚠️ Attenzione: Molte gare non hanno trovato l'azienda. Il set Aggiudicatari potrebbe non coprire il timeframe delle aggiudicazioni (o viceversa).\n")

    # ---------------------------------------------------------
    # STAMPA FINALE: TUTTE LE AGGIUDICAZIONI TROVATE (LEFT JOIN)
    # ---------------------------------------------------------
    print("=" * 80)
    print(f"📊 RISULTATI FINALI E SCONTI CALCOLATI (Sulle {len(aggiudicazioni)} Gare Aggiudicate):")
    print("=" * 80)

    competitor_stats = {}
    stampate = 0

    for id_agg, dati_aggiudicati in aggiudicazioni.items():
        stampate += 1
        cig = dati_aggiudicati["cig"]
        importo_agg = dati_aggiudicati["importo_agg"]
        
        gara_master = poste_cigs[cig]
        buyer = gara_master["buyer"]
        base_asta = gara_master["base_asta"]
        titolo = gara_master["titolo"]
        esito = gara_master["esito"]
        
        if dati_aggiudicati["vincitori"]:
            azienda_vincitrice = " & ".join(dati_aggiudicati["vincitori"])
        else:
            azienda_vincitrice = "Manca nel set Aggiudicatari fornito (Fornitore Ignoto)"

        print(f"[{stampate}/{len(aggiudicazioni)}] 🏛️ {buyer} - {esito}")
        print(f"📜 GARA [CIG: {cig}]: {titolo[:120]}...")
        print(f"🏆 VINCITORE:   {azienda_vincitrice}")
        
        v_base_str = f"€ {base_asta:,.2f}" if isinstance(base_asta, (int, float)) else "N/D"
        v_agg_str = f"€ {importo_agg:,.2f}" if isinstance(importo_agg, (int, float)) else "N/D"
        
        print(f"💰 Base d'Asta: {v_base_str}")
        print(f"💶 Aggiudicato: {v_agg_str}")
        
        if isinstance(base_asta, (int, float)) and isinstance(importo_agg, (int, float)) and base_asta > 0:
            sconto = (1 - (importo_agg / base_asta)) * 100
            print(f"📉 SCONTO GARA: {sconto:.2f}%")
            
            if dati_aggiudicati["vincitori"]:
                if azienda_vincitrice not in competitor_stats:
                    competitor_stats[azienda_vincitrice] = []
                competitor_stats[azienda_vincitrice].append(sconto)
        else:
            print("📉 SCONTO GARA: N/D")
            
        print("-" * 80)

    # ---------------------------------------------------------
    # INTELLIGENCE FINALE (CRUSCOTTO STATISTICO)
    # ---------------------------------------------------------
    if competitor_stats:
        print("\n" + "="*80)
        print("🧠 INTELLIGENCE COMPETITOR FINALE SU POSTE")
        print("="*80)
        
        sorted_comps = sorted(competitor_stats.items(), key=lambda x: len(x[1]), reverse=True)
        for comp, sconti in sorted_comps:
            media = sum(sconti) / len(sconti)
            max_sconto = max(sconti)
            min_sconto = min(sconti)
            print(f"- {comp[:40]:<40} | Sconto Medio: {media:05.2f}% | (Min: {min_sconto:05.2f}%, Max: {max_sconto:05.2f}%, su {len(sconti)} lotti)")

    print(f"\n✅ Crossover Relazionale Terminato!")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage:")
        print("python3 anac_poste_relational.py <PATH_CIG> <PATH_AGGIUDICAZIONI> <PATH_AGGIUDICATARI>")
        print("Sia <PATH_CIG> che <PATH_AGGIUDICATARI> possono essere cartelle oppure file singoli (.json).")
    else:
        analyze_anac_relations(sys.argv[1], sys.argv[2], sys.argv[3])
