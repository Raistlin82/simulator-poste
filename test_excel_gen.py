#!/usr/bin/env python
"""Quick test for excel generator"""
from backend.excel_generator import ExcelReportGenerator
print('Import successful')

gen = ExcelReportGenerator(
    lot_key='Test Lot',
    lot_config={
        'reqs': [],
        'company_certs': [
            {'id': 'cert1', 'name': 'ISO 9001', 'points': 5, 'gara_weight': 2},
            {'id': 'cert2', 'name': 'ISO 27001', 'points': 3, 'gara_weight': 1.5}
        ],
        'rti_enabled': True,
        'rti_companies': ['Partner1']
    },
    base_amount=1000000,
    my_discount=25,
    competitor_discount=30,
    technical_score=50,
    economic_score=20,
    total_score=70,
    details={},
    weighted_scores={},
    category_scores={'company_certs': 2.5, 'resource': 10, 'reference': 5, 'project': 8},
    max_tech_score=70,
    max_econ_score=30,
    alpha=0.2,
    win_probability=65,
    tech_inputs_full={'cert1': True, 'cert2': {'has_cert': True}},
    rti_quotas={'Lutech': 60, 'Partner1': 40}
)
buffer = gen.generate()
print(f'Generated Excel ({len(buffer.getvalue())} bytes)')
print('Test passed!')
