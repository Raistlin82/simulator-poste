
import requests
import json
import sys

# Mock Data similar to backend/main.py
LOT_CONFIG_DATA = {
    "Lotto 1": {
        "reqs": [
            {"id": "VAL_REQ_7", "label": "Technical PM (PMP/PgMP)", "max_points": 8, "type": "resource", "max_res": 2},
            {"id": "VAL_REQ_8", "label": "Cloud Lead (AWS/Azure/DevOps)", "max_points": 120, "type": "resource", "max_res": 10, "custom_formula": "C_times_R_plus_2"},
            {"id": "VAL_REQ_9", "label": "Architect Project Lead", "max_points": 35, "type": "resource", "max_res": 5},
            {"id": "VAL_REQ_10", "label": "Specialist Tech Lead", "max_points": 8, "type": "resource", "max_res": 2},
            {"id": "VAL_REQ_11", "label": "Ref. IaC / Cloud Platforms", "max_points": 28, "type": "reference", "bonus_val": 3.0},
            {"id": "VAL_REQ_12", "label": "Ref. Container & Microservizi", "max_points": 58, "type": "reference", "bonus_val": 3.0},
            {"id": "VAL_REQ_13", "label": "Organizzazione e Flessibilità", "max_points": 15, "type": "project"}
        ]
    },
    "Lotto 2": {
        "reqs": [
             {"id": "VAL_REQ_20", "label": "Project Tech Mgr (ITIL/PMP)", "max_points": 15, "type": "resource", "max_res": 3},
             {"id": "VAL_REQ_21", "label": "Service Trans. Expert", "max_points": 8, "type": "resource", "max_res": 2},
             {"id": "VAL_REQ_22", "label": "Tech Delivery Mgr", "max_points": 8, "type": "resource", "max_res": 2},
             {"id": "VAL_REQ_23", "label": "Transition Mgr", "max_points": 1, "type": "resource", "max_res": 1},
             {"id": "VAL_REQ_24", "label": "Ref. Service Transition", "max_points": 18, "type": "reference", "bonus_val": 3.0},
             {"id": "VAL_REQ_25", "label": "Ref. Secure DevOps", "max_points": 23, "type": "reference", "bonus_val": 3.0},
             {"id": "VAL_REQ_26", "label": "Organizzazione Servizio", "max_points": 20, "type": "project"}
        ]
    },
    "Lotto 3": {
        "reqs": [
             {"id": "VAL_REQ_33", "label": "Specialista Rete (Cisco)", "max_points": 15, "type": "resource", "max_res": 3},
             {"id": "VAL_REQ_34", "label": "Delivery DC", "max_points": 15, "type": "resource", "max_res": 3},
             {"id": "VAL_REQ_35", "label": "Operatore DC", "max_points": 8, "type": "resource", "max_res": 2},
             {"id": "VAL_REQ_36", "label": "Ref. Data Center Mgmt", "max_points": 17, "type": "reference", "bonus_val": 12.0},
             {"id": "VAL_REQ_37", "label": "Organizzazione DC", "max_points": 15, "type": "project"}
        ]
    }
}

def calculate_prof_score(R, C, max_res, max_points, custom_formula=None):
    # Enforce constraints
    R = min(R, max_res)
    C = min(C, 5) 
    if R < C: C = R 
    
    if custom_formula == "C_times_R_plus_2":
        score = C * (R + 2)
    else:
        score = (2 * R) + (R * C)
        
    return min(score, max_points)

def check_lotto(lotto_name):
    print(f"\n--- Checking {lotto_name} ---")
    reqs = LOT_CONFIG_DATA[lotto_name]["reqs"]
    
    for req in reqs:
        print(f"REQ: {req['id']} ({req['label']})")
        print(f"  Type: {req['type']}, Max Pts: {req['max_points']}")
        
        if req['type'] == 'resource':
            max_res = req['max_res']
            formula = req.get('custom_formula')
            # Test Max Score
            score = calculate_prof_score(max_res, 5, max_res, req['max_points'], formula)
            print(f"  MAX Inputs (R={max_res}, C=5) -> Score: {score}")
            if score != req['max_points']:
                 print(f"  WARNING: Max points mismatch! Expected {req['max_points']}, got {score}")
            else:
                 print("  OK: Max points reachable.")
                 
            # Test Half Score if possible
            if max_res > 1:
                half_res = max_res // 2
                score_half = calculate_prof_score(half_res, 2, max_res, req['max_points'], formula)
                print(f"  MID Inputs (R={half_res}, C=2) -> Score: {score_half}")
        
        elif req['type'] == 'reference':
            # Check if bonus + max logic makes sense (simplified check)
            bonus = req.get('bonus_val', 0)
            print(f"  Bonus Available: {bonus}")
            # We assume sub-reqs sum to (Max - Bonus) usually or similar logic
            # This is harder to verify without sub-req weights in this script
            pass

if __name__ == "__main__":
    check_lotto("Lotto 1")
    check_lotto("Lotto 2")
    check_lotto("Lotto 3")
