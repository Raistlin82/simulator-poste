import { describe, it, expect } from 'vitest'
import { getEffectiveDaysYear } from '../teamUtils'

describe('getEffectiveDaysYear', () => {
  it('uses manual_days_year when set (> 0)', () => {
    expect(getEffectiveDaysYear({ manual_days_year: 180, fte: 1 }, 220)).toBe(180)
  })

  it('falls back to fte * daysPerFte when no manual override', () => {
    expect(getEffectiveDaysYear({ fte: 2 }, 220)).toBe(440)
  })

  it('treats manual_days_year of 0 as unset and uses fte', () => {
    expect(getEffectiveDaysYear({ manual_days_year: 0, fte: 1 }, 220)).toBe(220)
  })

  it('returns 0 when fte is missing and no manual override', () => {
    expect(getEffectiveDaysYear({}, 220)).toBe(0)
  })

  it('parses string fte values', () => {
    expect(getEffectiveDaysYear({ fte: '1.5' }, 200)).toBe(300)
  })
})
