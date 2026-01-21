
import requests
import json
import time

# Wait for server restart
time.sleep(2)

url = "http://localhost:8000/calculate"

payload = {
    "lot_key": "Lotto 1",
    "base_amount": 16837200.0,
    "competitor_discount": 0,
    "my_discount": 0,
    "tech_inputs": [
        # Max out Cloud Lead: 10 Res, 10 Certs => 10 * (10 + 2) = 120
        # Wait, usually C <= R. If R=10, C=10.
        {"req_id": "VAL_REQ_8", "r_val": 10, "c_val": 10} 
    ],
    "company_certs_count": 0
}

try:
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        data = response.json()
        score = data['details'].get('VAL_REQ_8', 0)
        print(f"VAL_REQ_8 Score: {score}")
        
        if score == 120:
            print("SUCCESS: VAL_REQ_8 score is 120.")
        else:
            print(f"FAILURE: VAL_REQ_8 score is {score}, expected 120.")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
