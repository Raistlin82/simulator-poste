import { describe, it, expect } from 'vitest'
import { normalizeBPForUI, normalizeBPForAPI } from '../businessPlanNormalizers'

describe('businessPlanNormalizers', () => {
  it('converts decimal (API) percentages to 0-100 for the UI', () => {
    const ui = normalizeBPForUI({ governance_pct: 0.04, risk_contingency_pct: 0.03, reuse_factor: 0.15 })
    expect(ui.governance_pct).toBeCloseTo(4)
    expect(ui.risk_contingency_pct).toBeCloseTo(3)
    expect(ui.reuse_factor).toBeCloseTo(15)
  })

  it('round-trips UI -> API -> back to the original decimals', () => {
    const api = { governance_pct: 0.04, risk_contingency_pct: 0.03, reuse_factor: 0.15 }
    const back = normalizeBPForAPI(normalizeBPForUI(api))
    expect(back.governance_pct).toBeCloseTo(0.04)
    expect(back.risk_contingency_pct).toBeCloseTo(0.03)
    expect(back.reuse_factor).toBeCloseTo(0.15)
  })

  it('applies sensible defaults when fields are missing', () => {
    const ui = normalizeBPForUI({})
    expect(ui.governance_pct).toBeCloseTo(4) // 0.04 default
    expect(ui.risk_contingency_pct).toBeCloseTo(3) // 0.03 default
    expect(ui.reuse_factor).toBe(0)
    expect(ui.governance_mode).toBe('percentage')
    expect(ui.max_subcontract_pct).toBe(20)
  })
})
