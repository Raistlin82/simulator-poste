
import requests
import json

url = "http://localhost:8000/calculate"

payload = {
    "lot_key": "Lotto 1",
    "base_amount": 100000.0,
    "competitor_discount": 20.0,
    "my_discount": 10.0,
    "tech_inputs": [],
    "company_certs_count": 0
}

response = requests.post(url, json=payload)
data = response.json()

print(json.dumps(data, indent=2))

expected_econ = 32.49
actual_econ = data['economic_score']

if abs(actual_econ - expected_econ) < 0.1:
    print("SUCCESS: Economic score calculation is correct.")
else:
    print(f"FAILURE: Economic score mismatch. Expected ~{expected_econ}, got {actual_econ}")
