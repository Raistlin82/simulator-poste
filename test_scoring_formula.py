#!/usr/bin/env python3
"""
Test della formula di scoring: Pmax = Σ(Pei × Vi)
Dove:
- Pei = peso del criterio i
- Vi = giudizio discrezionale (0, 2, 3, 4, 5)
"""

def test_scoring_formula():
    """
    Test Example:
    Reference Criteria:
    - Grado Aderenza (weight: 1.0) -> value: 5 -> 1.0 * 5 = 5.0
    - Linee Guida Arch (weight: 1.0) -> value: 4 -> 1.0 * 4 = 4.0
    - Requisiti NF (weight: 1.0) -> value: 3 -> 1.0 * 3 = 3.0
    - Perf Test & Tuning (weight: 1.0) -> value: 2 -> 1.0 * 2 = 2.0
    - Setup Ambienti (weight: 1.0) -> value: 0 -> 1.0 * 0 = 0.0
    - Gestione Rilasci (weight: 1.0) -> value: 5 -> 1.0 * 5 = 5.0
    - Supporto Test/Cert (weight: 1.0) -> value: 4 -> 1.0 * 4 = 4.0
    - Strumenti (weight: 1.0) -> value: 3 -> 1.0 * 3 = 3.0
    - Ambiti Tecnologici (weight: 1.0) -> value: 5 -> 1.0 * 5 = 5.0
    - Tipologia Ambienti (weight: 1.0) -> value: 4 -> 1.0 * 4 = 4.0
    - Produttività (weight: 1.0) -> value: 3 -> 1.0 * 3 = 3.0
    
    Total Pmax (no bonus) = 5+4+3+2+0+5+4+3+5+4+3 = 38.0
    With bonus (+3) = 38.0 + 3.0 = 41.0
    Max score for this requirement: 58.0 (from lot_configs.json)
    Normalized: min(41.0, 58.0) = 41.0 points
    """
    
    # Simulate criterion weights and values
    criteria = [
        {"id": "a", "label": "Grado Aderenza", "weight": 1.0, "value": 5},
        {"id": "b", "label": "Linee Guida Arch.", "weight": 1.0, "value": 4},
        {"id": "c", "label": "Requisiti NF", "weight": 1.0, "value": 3},
        {"id": "d", "label": "Perf. Test & Tuning", "weight": 1.0, "value": 2},
        {"id": "e", "label": "Setup Ambienti", "weight": 1.0, "value": 0},
        {"id": "f", "label": "Gestione Rilasci", "weight": 1.0, "value": 5},
        {"id": "g", "label": "Supporto Test/Cert", "weight": 1.0, "value": 4},
        {"id": "h", "label": "Strumenti", "weight": 1.0, "value": 3},
        {"id": "i", "label": "Ambiti Tecnologici", "weight": 1.0, "value": 5},
        {"id": "j", "label": "Tipologia Ambienti", "weight": 1.0, "value": 4},
        {"id": "k", "label": "Produttività", "weight": 1.0, "value": 3},
    ]
    
    # Calculate score: Pmax = Σ(Pei × Vi)
    sub_score_sum = sum(crit["weight"] * crit["value"] for crit in criteria)
    
    # Add bonus
    bonus = 3.0
    total_with_bonus = sub_score_sum + bonus
    
    # Cap to max_points
    max_points = 58.0
    final_score = min(total_with_bonus, max_points)
    
    print(f"Formula Test: Pmax = Σ(Pei × Vi)")
    print(f"{'='*60}")
    for crit in criteria:
        contribution = crit["weight"] * crit["value"]
        print(f"{crit['label']:30s} | P={crit['weight']:3.1f} × V={crit['value']:1d} = {contribution:5.1f}")
    print(f"{'='*60}")
    print(f"Subtotal (no bonus): {sub_score_sum:5.1f}")
    print(f"Bonus:                {bonus:5.1f}")
    print(f"Total (before cap):   {total_with_bonus:5.1f}")
    print(f"Max Points:           {max_points:5.1f}")
    print(f"Final Score:          {final_score:5.1f}")
    
    assert sub_score_sum == 38.0, f"Expected 38.0, got {sub_score_sum}"
    assert total_with_bonus == 41.0, f"Expected 41.0, got {total_with_bonus}"
    assert final_score == 41.0, f"Expected 41.0, got {final_score}"
    
    print(f"\n✓ All tests passed!")
    
    # Test 2: Different weights
    print(f"\n{'='*60}")
    print("Test 2: With non-uniform weights")
    print(f"{'='*60}")
    
    criteria2 = [
        {"id": "a", "label": "Grado Aderenza", "weight": 0.5, "value": 5},
        {"id": "b", "label": "Linee Guida", "weight": 1.5, "value": 4},
        {"id": "c", "label": "Requisiti NF", "weight": 1.0, "value": 3},
    ]
    
    sub_score_sum2 = sum(crit["weight"] * crit["value"] for crit in criteria2)
    bonus2 = 0  # No bonus
    total2 = sub_score_sum2 + bonus2
    
    for crit in criteria2:
        contribution = crit["weight"] * crit["value"]
        print(f"{crit['label']:30s} | P={crit['weight']:3.1f} × V={crit['value']:1d} = {contribution:5.1f}")
    print(f"{'='*60}")
    print(f"Total Score: {total2:5.1f}")
    
    assert sub_score_sum2 == 11.5, f"Expected 11.5, got {sub_score_sum2}"
    assert total2 == 11.5, f"Expected 11.5, got {total2}"
    
    print(f"\n✓ Test 2 passed!")

if __name__ == "__main__":
    test_scoring_formula()
