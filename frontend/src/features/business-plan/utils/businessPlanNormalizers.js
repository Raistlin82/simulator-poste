import { DAYS_PER_FTE, DEFAULT_DAILY_RATE } from '../constants';

/**
 * Normalizza un BP proveniente dall'API per l'uso nell'UI.
 * Converte i valori decimali (0-1) in percentuali (0-100).
 */
export const normalizeBPForUI = (bp) => ({
  ...bp,
  governance_pct: (bp.governance_pct || 0.04) * 100,
  risk_contingency_pct: (bp.risk_contingency_pct || 0.03) * 100,
  reuse_factor: (bp.reuse_factor || 0) * 100,
  days_per_fte: bp.days_per_fte || DAYS_PER_FTE,
  default_daily_rate: bp.default_daily_rate || DEFAULT_DAILY_RATE,
  governance_mode: bp.governance_mode || 'percentage',
  governance_fte_periods: bp.governance_fte_periods || [],
  governance_apply_reuse: bp.governance_apply_reuse || false,
  governance_profile_mix: bp.governance_profile_mix || [],
  governance_cost_manual: bp.governance_cost_manual ?? null,
  margin_warning_threshold: bp.margin_warning_threshold ?? 0.05,
  margin_success_threshold: bp.margin_success_threshold ?? 0.15,
  inflation_pct: bp.inflation_pct ?? 0,
  max_subcontract_pct: bp.max_subcontract_pct ?? 20,
});

/**
 * Normalizza un BP dall'UI per l'invio all'API.
 * Converte i valori percentuali (0-100) in decimali (0-1).
 */
export const normalizeBPForAPI = (bp) => ({
  ...bp,
  governance_pct: bp.governance_pct / 100,
  risk_contingency_pct: bp.risk_contingency_pct / 100,
  reuse_factor: bp.reuse_factor / 100,
});
