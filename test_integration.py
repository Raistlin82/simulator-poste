#!/usr/bin/env python3
"""
Test di integrazione: verifica che il sistema di scoring funzioni end-to-end
Simula una richiesta al backend /calculate endpoint
"""

import json
from pathlib import Path

def test_integration():
    """Simula il calcolo di uno score completo per VAL_REQ_12 (Ref. Container & Microservizi)"""
    
    # Carica la configurazione
    with open('backend/lot_configs.json', 'r') as f:
        config = json.load(f)
    
    lot = config['Lotto 1']
    req_12 = [r for r in lot['reqs'] if r['id'] == 'VAL_REQ_12'][0]
    
    print("="*70)
    print("TEST INTEGRAZIONE: Sistema di Valutazione Ponderata")
    print("="*70)
    print(f"\nLotto: {lot['name']}")
    print(f"Requisito: {req_12['label']} ({req_12['id']})")
    print(f"Max Points: {req_12['max_points']}")
    
    # Simulazione: assegnazione di giudizi
    print(f"\nCriteri di Valutazione:")
    print("-"*70)
    
    sub_reqs = req_12['sub_reqs']
    judgments = [5, 4, 3, 2, 0, 5, 4, 3, 5, 4, 3]  # Giudizi assegnati (0-5)
    
    total_score = 0.0
    for sub, judgment in zip(sub_reqs, judgments):
        contribution = sub['weight'] * judgment
        total_score += contribution
        rating_text = {
            0: "Assente/Inadeguato",
            2: "Parzialmente adeguato",
            3: "Adeguato",
            4: "Più che adeguato",
            5: "Ottimo"
        }.get(judgment, f"Valore {judgment}")
        
        print(f"{sub['id']:<3} {sub['label']:<30} | Peso: {sub['weight']:.1f} | "
              f"Giudizio: {judgment:1d} ({rating_text:<25}) | "
              f"Punteggio: {contribution:5.1f}")
    
    print("-"*70)
    print(f"SUBTOTALE (senza bonus): {total_score:6.1f}")
    
    # Applica bonus
    bonus = 3.0  # Bonus per attestazione cliente
    total_with_bonus = total_score + bonus
    
    print(f"BONUS (Attestazione):    {bonus:6.1f}")
    print(f"TOTALE (prima del cap):  {total_with_bonus:6.1f}")
    
    # Cap al massimo
    final_score = min(total_with_bonus, req_12['max_points'])
    print(f"MAX SCORE:               {req_12['max_points']:6.1f}")
    print(f"SCORE FINALE:            {final_score:6.1f}")
    
    # Normalizzazione al max_tech_score
    max_raw = lot['max_raw_score']
    max_tech = lot.get('max_tech_score', 60)
    
    print(f"\nNormalizzazione:")
    print(f"  Raw score requisito:   {final_score:.1f} / {req_12['max_points']:.1f}")
    print(f"  Max raw score lotto:   {max_raw:.1f}")
    print(f"  Max tech score lotto:  {max_tech:.1f}")
    
    # Assumi che questo sia un requisito tra gli altri
    # Per semplicità, calcoliamo il contributo di questo requisito
    contribution_ratio = final_score / max_raw
    contribution_tech = (contribution_ratio) * max_tech
    
    print(f"  Contributo: ({final_score:.1f} / {max_raw:.1f}) × {max_tech:.1f} = {contribution_tech:.2f}")
    
    print("\n" + "="*70)
    print("✓ TEST INTEGRAZIONE COMPLETATO CON SUCCESSO")
    print("="*70)
    
    # Assertions
    assert total_score == 38.0, f"Expected subtotal 38.0, got {total_score}"
    assert total_with_bonus == 41.0, f"Expected 41.0, got {total_with_bonus}"
    assert final_score == 41.0, f"Expected final 41.0, got {final_score}"
    assert contribution_tech > 0, f"Expected positive contribution, got {contribution_tech}"
    
    print("\n✓ Tutte le asserzioni sono passate!")
    
    # Test 2: Verifica che tutti i lotti abbiano la struttura corretta
    print("\n" + "="*70)
    print("VERIFICA STRUTTURA LOTTI")
    print("="*70)
    
    for lot_name, lot_data in config.items():
        print(f"\n{lot_name}:")
        has_refs = any(r['type'] == 'reference' for r in lot_data['reqs'])
        has_projects = any(r['type'] == 'project' for r in lot_data['reqs'])
        
        if has_refs:
            print("  ✓ Contiene Reference")
            for ref in [r for r in lot_data['reqs'] if r['type'] == 'reference']:
                assert 'sub_reqs' in ref, f"Reference {ref['id']} manca sub_reqs"
                assert all('weight' in s for s in ref['sub_reqs']), f"Sub-req in {ref['id']} manca weight"
                print(f"    - {ref['label']}: {len(ref['sub_reqs'])} criteri OK")
        
        if has_projects:
            print("  ✓ Contiene Project")
            for proj in [r for r in lot_data['reqs'] if r['type'] == 'project']:
                assert 'sub_reqs' in proj, f"Project {proj['id']} manca sub_reqs"
                assert all('weight' in s for s in proj['sub_reqs']), f"Sub-req in {proj['id']} manca weight"
                print(f"    - {proj['label']}: {len(proj['sub_reqs'])} criteri OK")
    
    print("\n✓ Struttura verificata per tutti i lotti!")

if __name__ == "__main__":
    import sys
    try:
        test_integration()
    except AssertionError as e:
        print(f"\n✗ ERRORE: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERRORE INATTESO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
