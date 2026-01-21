
import requests
import json
import math

API_URL = "http://localhost:8000"

def calculate_prof_score_local(R, C, max_res, max_points, max_certs=5, custom_formula=None):
    R = min(R, max_res)
    C = min(C, max_certs)
    if R < C: C = R
    
    if custom_formula == "C_times_R_plus_2":
        score = C * (R + 2)
    else:
        score = (2 * R) + (R * C)
    return min(score, max_points)

def run_verification():
    print("Fetching Configuration...")
    try:
        config = requests.get(f"{API_URL}/config").json()
    except Exception as e:
        print(f"Failed to fetch config: {e}")
        return

    print(f"\n{'LOT':<10} | {'REQ ID':<15} | {'TEST CASE':<30} | {'EXPECTED':<10} | {'ACTUAL':<10} | {'STATUS'}")
    print("-" * 100)

    # Prepare batch test payload
    tech_inputs = []
    
    # We will test each requirement individually by sending a request with ONLY that req active (or all active but we focus on one)
    # Actually simpler: we can just calculate what we expect locally and compare with what backend returns for a specific payload.
    # Let's check "MAX" case for everything first.
    
    test_inputs = [] # list of { req_id, r_val, c_val, qual_val, bonus_active, sub_req_vals }
    expected_scores = {}

    for lot_key, lot_data in config.items():
        for req in lot_data['reqs']:
            req_id = req['id']
            max_p = req['max_points']
            
            # Case 1: MAX Score
            if req['type'] == 'resource':
                max_res = req['max_res']
                max_c = req.get('max_certs', 5)
                # Maximize inputs
                inp = {"req_id": req_id, "r_val": max_res, "c_val": max_c, "bonus_active": False}
                test_inputs.append(inp)
                
                exp = calculate_prof_score_local(max_res, max_c, max_res, max_p, max_c, req.get('custom_formula'))
                expected_scores[req_id] = exp
                
            elif req['type'] in ['reference', 'project']:
                # Maximize qualitative
                # For references/projects, logic is sum of weighted sub-reqs + bonus
                # We assume "Ottimo/Eccellente" maps to max value (5?) in backend logic for sub-reqs?
                # Backend logic for sub-reqs:
                # val = val_map.get(...) float(val).
                # Wait, backend says: val is 0-5.
                # So if we send val=5 for all sub-reqs.
                
                # Check backend code again... 
                # "val = val_map.get(sub.id, 3)"
                # "sub_score_sum += sub.weight * val"
                
                # Let's create sub_req_vals with 5 for all
                sub_reqs = req.get('sub_reqs', [])
                sub_vals = [{"sub_id": s['id'], "val": 5} for s in sub_reqs]
                
                inp = {
                    "req_id": req_id, 
                    "qual_val": "Eccellente", 
                    "bonus_active": True,
                    "sub_req_vals": sub_vals
                }
                test_inputs.append(inp)
                
                # Calc expected
                score_sum = sum([s['weight'] * 5 for s in sub_reqs])
                bonus = req.get('bonus_val')
                if bonus is None: bonus = 0.0
                exp = min(score_sum + bonus, max_p)
                expected_scores[req_id] = exp

    # Send payload
    payload = {
        "lot_key": "Lotto 1", # We'll just run this once per lot actually, or merge all inputs?
        # The backend endpoint takes "lot_key". So we must do it per lot.
        "base_amount": 100, 
        "competitor_discount": 0, "my_discount": 0,
        "tech_inputs": [],
        "company_certs_count": 0
    }
    
    # Run Per Lot
    for lot_key in config.keys():
        # filter inputs for this lot
        lot_req_ids = [r['id'] for r in config[lot_key]['reqs']]
        lot_inputs = [i for i in test_inputs if i['req_id'] in lot_req_ids]
        
        payload['lot_key'] = lot_key
        payload['tech_inputs'] = lot_inputs
        
        try:
            resp = requests.post(f"{API_URL}/calculate", json=payload)
            data = resp.json()
            details = data['details']
            
            for inp in lot_inputs:
                rid = inp['req_id']
                act = details.get(rid, 0)
                exp = expected_scores[rid]
                
                status = "PASS" if abs(act - exp) < 0.01 else "FAIL"
                print(f"{lot_key:<10} | {rid:<15} | {'MAX Inputs':<30} | {exp:<10} | {act:<10} | {status}")
                
        except Exception as e:
            print(f"Error testing {lot_key}: {e}")

if __name__ == "__main__":
    run_verification()
