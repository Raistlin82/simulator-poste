import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, Percent, Plus, Trash2, Edit3, Lock, Unlock, ChevronDown, ChevronUp, Calendar, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

/**
 * ParametersPanel - Pannello per parametri generali BP
 * Gestisce: governance (con 4 modalità), risk_contingency, reuse_factor
 *
 * Governance Modes:
 * - percentage: governance come % del team
 * - fte: governance come FTE con time slices
 * - manual: costo governance inserito manualmente
 * - team_mix: governance calcolata da mix profili Lutech
 */
export default function ParametersPanel({
  values = {},
  practices = [],
  totalTeamFte = 0,
  durationMonths,
  daysPerFte = 220,
  onChange,
  disabled = false
}) {
  const { t } = useTranslation();
  const [expandedPeriod, setExpandedPeriod] = useState(null);

  const defaults = {
    governance_pct: 4,
    risk_contingency_pct: 3,
    reuse_factor: 0,
    governance_profile_mix: [],
    governance_cost_manual: null,
    governance_mode: 'percentage',
    governance_fte_periods: [],
    governance_apply_reuse: false,
  };

  const current = { ...defaults, ...values };

  const handleChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    onChange?.({ ...current, [field]: numValue });
  };

  const handleFieldChange = (field, value) => {
    onChange?.({ ...current, [field]: value });
  };

  // Catalogo profili Lutech flat
  const lutechProfiles = useMemo(() => {
    return practices.flatMap(practice =>
      (practice.profiles || []).map(profile => ({
        ...profile,
        practice_id: practice.id,
        practice_label: practice.label,
        full_id: `${practice.id}:${profile.id}`,
      }))
    );
  }, [practices]);

  // Governance FTE based on percentage
  const governanceFteFromPct = totalTeamFte * (current.governance_pct / 100);

  // === MODE: PERCENTAGE ===
  // governance_cost = team_cost * governance_pct

  // === MODE: FTE ===
  // governance_cost = sum of (fte * avg_rate * days * months) per period
  const governanceFteInfo = useMemo(() => {
    if (current.governance_mode !== 'fte' || current.governance_fte_periods.length === 0) {
      return { totalFte: 0, totalCost: 0, avgRate: 0 };
    }

    const years = durationMonths / 12;
    let totalCost = 0;
    let totalFte = 0;
    let weightedRate = 0;

    for (const period of current.governance_fte_periods) {
      const periodFte = parseFloat(period.fte) || 0;
      const periodMonths = (period.month_end || durationMonths) - (period.month_start || 1) + 1;
      const periodYears = periodMonths / 12;

      // Calculate average rate for this period's team mix
      const mix = period.team_mix || [];
      let periodAvgRate = 0;
      let totalPct = 0;

      for (const item of mix) {
        const profile = lutechProfiles.find(p => p.full_id === item.lutech_profile);
        if (profile) {
          const pct = (item.pct || 0) / 100;
          totalPct += pct;
          periodAvgRate += (profile.daily_rate || 0) * pct;
        }
      }

      if (totalPct > 0) {
        periodAvgRate = periodAvgRate / totalPct;
      }

      const periodCost = periodFte * periodAvgRate * daysPerFte * periodYears;
      totalCost += periodCost;
      totalFte += periodFte;
      weightedRate += periodAvgRate * periodFte;
    }

    const avgRate = totalFte > 0 ? weightedRate / totalFte : 0;
    return { totalFte, totalCost, avgRate };
  }, [current.governance_mode, current.governance_fte_periods, durationMonths, lutechProfiles, daysPerFte]);

  // === MODE: TEAM_MIX ===
  // Governance mix: calcola tariffa media dalla distribuzione
  const governanceMixInfo = useMemo(() => {
    const mix = current.governance_profile_mix || [];
    if (mix.length === 0 || lutechProfiles.length === 0) {
      return { avgRate: 0, totalPct: 0, isComplete: false };
    }

    let totalPct = 0;
    let weightedRate = 0;

    for (const item of mix) {
      const profile = lutechProfiles.find(p => p.full_id === item.lutech_profile);
      if (profile) {
        const pct = (item.pct || 0) / 100;
        totalPct += pct;
        weightedRate += (profile.daily_rate || 0) * pct;
      }
    }

    const avgRate = totalPct > 0 ? weightedRate / totalPct : 0;
    return {
      avgRate,
      totalPct: totalPct * 100,
      isComplete: Math.abs(totalPct - 1) < 0.01,
    };
  }, [current.governance_profile_mix, lutechProfiles]);

  // Governance cost calcolato (per mode team_mix)
  const durationYears = durationMonths / 12;
  const calculatedGovernanceCostTeamMix = governanceFteFromPct * daysPerFte * durationYears * governanceMixInfo.avgRate;

  // === GOVERNANCE MODE SELECTOR ===
  const governanceModes = [
    { value: 'percentage', label: 'Percentuale', icon: Percent, desc: 'Governance come % del team' },
    { value: 'fte', label: 'FTE', icon: Calendar, desc: 'Governance come FTE con time slices' },
    { value: 'manual', label: 'Manuale', icon: Edit3, desc: 'Costo inserito manualmente' },
    { value: 'team_mix', label: 'Team Mix', icon: Settings2, desc: 'Calcolato da mix profili' },
  ];

  // --- Governance FTE periods handlers ---
  const handleAddFtePeriod = () => {
    const periods = current.governance_fte_periods || [];
    let lastMonth = 0;
    periods.forEach(p => {
      if (p.month_end && p.month_end > lastMonth) {
        lastMonth = p.month_end;
      }
    });

    const newMonthStart = lastMonth + 1;
    const newMonthEnd = Math.min(newMonthStart + 11, durationMonths);

    const newPeriods = [
      ...periods,
      {
        month_start: newMonthStart,
        month_end: newMonthEnd,
        fte: 1.0,
        team_mix: []
      }
    ];

    handleFieldChange('governance_fte_periods', newPeriods);
    setExpandedPeriod(newPeriods.length - 1);
  };

  const handleRemoveFtePeriod = (index) => {
    const newPeriods = (current.governance_fte_periods || []).filter((_, i) => i !== index);
    handleFieldChange('governance_fte_periods', newPeriods);
  };

  const handleUpdateFtePeriod = (index, field, value) => {
    const periods = (current.governance_fte_periods || []).map((p, i) => {
      if (i !== index) return p;
      return { ...p, [field]: value };
    });
    handleFieldChange('governance_fte_periods', periods);
  };

  const handleAddMixToFtePeriod = (periodIndex) => {
    const periods = (current.governance_fte_periods || []).map((p, i) => {
      if (i !== periodIndex) return p;
      const mix = [...(p.team_mix || [])];
      const remaining = 100 - mix.reduce((sum, m) => sum + (m.pct || 0), 0);
      mix.push({ lutech_profile: '', pct: Math.max(0, remaining) });
      return { ...p, team_mix: mix };
    });
    handleFieldChange('governance_fte_periods', periods);
  };

  const handleRemoveMixFromFtePeriod = (periodIndex, mixIndex) => {
    const periods = (current.governance_fte_periods || []).map((p, i) => {
      if (i !== periodIndex) return p;
      return { ...p, team_mix: (p.team_mix || []).filter((_, mi) => mi !== mixIndex) };
    });
    handleFieldChange('governance_fte_periods', periods);
  };

  const handleUpdateFtePeriodMix = (periodIndex, mixIndex, field, value) => {
    const periods = (current.governance_fte_periods || []).map((p, i) => {
      if (i !== periodIndex) return p;
      const mix = (p.team_mix || []).map((m, mi) => {
        if (mi !== mixIndex) return m;
        return { ...m, [field]: field === 'pct' ? (parseFloat(value) || 0) : value };
      });
      return { ...p, team_mix: mix };
    });
    handleFieldChange('governance_fte_periods', periods);
  };

  // Sync periods from duration
  const handleSyncFtePeriods = () => {
    const defaultPeriod = {
      month_start: 1,
      month_end: durationMonths,
      fte: governanceFteFromPct,
      team_mix: current.governance_profile_mix || []
    };
    handleFieldChange('governance_fte_periods', [defaultPeriod]);
    setExpandedPeriod(0);
  };

  // --- Governance mix handlers (for team_mix mode) ---
  const handleAddGovProfile = () => {
    const mix = [...(current.governance_profile_mix || [])];
    const remaining = 100 - mix.reduce((sum, m) => sum + (m.pct || 0), 0);
    mix.push({ lutech_profile: '', pct: Math.max(0, remaining) });
    handleFieldChange('governance_profile_mix', mix);
  };

  const handleRemoveGovProfile = (index) => {
    const mix = (current.governance_profile_mix || []).filter((_, i) => i !== index);
    handleFieldChange('governance_profile_mix', mix);
  };

  const handleUpdateGovProfile = (index, field, value) => {
    const mix = (current.governance_profile_mix || []).map((m, i) => {
      if (i !== index) return m;
      return { ...m, [field]: field === 'pct' ? (parseFloat(value) || 0) : value };
    });
    handleFieldChange('governance_profile_mix', mix);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Calculate period info for display
  const getPeriodLabel = (period) => {
    const start = period.month_start || 1;
    const end = period.month_end || durationMonths;
    return `Mesi ${start}-${end} (${end - start + 1} mesi)`;
  };

  const getPeriodMixInfo = (period) => {
    const mix = period.team_mix || [];
    if (mix.length === 0) return { avgRate: 0, totalPct: 0 };

    let totalPct = 0;
    let weightedRate = 0;

    for (const item of mix) {
      const profile = lutechProfiles.find(p => p.full_id === item.lutech_profile);
      if (profile) {
        const pct = (item.pct || 0) / 100;
        totalPct += pct;
        weightedRate += (profile.daily_rate || 0) * pct;
      }
    }

    const avgRate = totalPct > 0 ? weightedRate / totalPct : 0;
    return { avgRate, totalPct: totalPct * 100 };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">
              {t('business_plan.parameters')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('business_plan.parameters_desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* ═══ GOVERNANCE SECTION ═══ */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-600" />
            <h4 className="font-semibold text-blue-800">Governance</h4>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-blue-700 uppercase">Modalità Calcolo</label>
            <div className="grid grid-cols-2 gap-2">
              {governanceModes.map(mode => {
                const Icon = mode.icon;
                const isActive = current.governance_mode === mode.value;
                return (
                  <button
                    key={mode.value}
                    onClick={() => handleFieldChange('governance_mode', mode.value)}
                    disabled={disabled}
                    className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                        : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-xs font-semibold">{mode.label}</div>
                      <div className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-blue-500'}`}>
                        {mode.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODE: PERCENTAGE */}
          {current.governance_mode === 'percentage' && (
            <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-2">
              <label className="text-xs font-medium text-blue-700">Percentuale Governance</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={25}
                  step={0.5}
                  value={current.governance_pct}
                  onChange={(e) => handleChange('governance_pct', e.target.value)}
                  disabled={disabled}
                  className="w-20 px-3 py-2 text-center border border-blue-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-blue-600">%</span>
                <span className="ml-auto text-xs text-blue-600">
                  = {governanceFteFromPct.toFixed(2)} FTE
                </span>
              </div>
            </div>
          )}

          {/* MODE: FTE */}
          {current.governance_mode === 'fte' && (
            <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-blue-700 uppercase">Time Slices Governance FTE</label>
                <button
                  onClick={handleSyncFtePeriods}
                  disabled={disabled}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                             text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200"
                  title="Crea periodo default sincronizzato con durata contratto"
                >
                  <RefreshCw className="w-3 h-3" />
                  Sincronizza Periodi
                </button>
              </div>

              {(current.governance_fte_periods || []).length === 0 && (
                <div className="text-center py-4 text-slate-500 text-xs">
                  Nessun periodo definito. Clicca "Aggiungi Periodo" o "Sincronizza Periodi"
                </div>
              )}

              {(current.governance_fte_periods || []).map((period, idx) => {
                const isExpanded = expandedPeriod === idx;
                const mixInfo = getPeriodMixInfo(period);
                return (
                  <div key={idx} className="border border-blue-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedPeriod(isExpanded ? null : idx)}
                      className="w-full flex items-center justify-between p-2 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="text-xs font-medium text-blue-800">{getPeriodLabel(period)}</div>
                          <div className="text-[10px] text-blue-600">
                            {period.fte || 0} FTE · Tariffa media: €{mixInfo.avgRate.toFixed(0)}/gg
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveFtePeriod(idx); }}
                          disabled={disabled}
                          className="p-1 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 bg-blue-50 space-y-3 border-t border-blue-200">
                        {/* Period range */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-blue-600 font-medium">Mese Inizio</label>
                            <input
                              type="number"
                              value={period.month_start || 1}
                              onChange={(e) => handleUpdateFtePeriod(idx, 'month_start', parseInt(e.target.value) || 1)}
                              disabled={disabled}
                              min={1}
                              max={durationMonths}
                              className="w-full px-2 py-1 text-xs border border-blue-200 rounded"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-blue-600 font-medium">Mese Fine</label>
                            <input
                              type="number"
                              value={period.month_end || durationMonths}
                              onChange={(e) => handleUpdateFtePeriod(idx, 'month_end', parseInt(e.target.value) || durationMonths)}
                              disabled={disabled}
                              min={1}
                              max={durationMonths}
                              className="w-full px-2 py-1 text-xs border border-blue-200 rounded"
                            />
                          </div>
                        </div>

                        {/* FTE */}
                        <div>
                          <label className="text-[10px] text-blue-600 font-medium">FTE Governance</label>
                          <input
                            type="number"
                            value={period.fte || 0}
                            onChange={(e) => handleUpdateFtePeriod(idx, 'fte', parseFloat(e.target.value) || 0)}
                            disabled={disabled}
                            min={0}
                            step={0.1}
                            className="w-full px-2 py-1 text-xs border border-blue-200 rounded"
                          />
                        </div>

                        {/* Team Mix */}
                        <div className="space-y-2">
                          <label className="text-[10px] text-blue-600 font-medium">Mix Profili</label>
                          {(period.team_mix || []).map((item, mixIdx) => (
                            <div key={mixIdx} className="flex items-center gap-1">
                              <select
                                value={item.lutech_profile}
                                onChange={(e) => handleUpdateFtePeriodMix(idx, mixIdx, 'lutech_profile', e.target.value)}
                                disabled={disabled}
                                className="flex-1 px-2 py-1 border border-blue-200 rounded text-[10px] bg-white"
                              >
                                <option value="">-- Profilo --</option>
                                {practices.map(p => (
                                  <optgroup key={p.id} label={p.label}>
                                    {(p.profiles || []).map(prof => (
                                      <option key={`${p.id}:${prof.id}`} value={`${p.id}:${prof.id}`}>
                                        {prof.label} - €{prof.daily_rate}/gg
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={item.pct}
                                onChange={(e) => handleUpdateFtePeriodMix(idx, mixIdx, 'pct', e.target.value)}
                                disabled={disabled}
                                min={0}
                                max={100}
                                step={5}
                                className="w-14 px-1 py-1 text-center text-[10px] border border-blue-200 rounded"
                              />
                              <span className="text-[10px] text-blue-600">%</span>
                              <button
                                onClick={() => handleRemoveMixFromFtePeriod(idx, mixIdx)}
                                disabled={disabled}
                                className="p-1 text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleAddMixToFtePeriod(idx)}
                            disabled={disabled}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
                                       text-blue-600 hover:bg-blue-100 rounded-md"
                          >
                            <Plus className="w-3 h-3" />
                            Profilo
                          </button>
                          {mixInfo.totalPct !== 100 && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              Totale: {mixInfo.totalPct.toFixed(0)}% (deve essere 100%)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={handleAddFtePeriod}
                disabled={disabled}
                className="flex items-center gap-1 px-3 py-2 w-full text-xs font-medium
                           text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-200"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Periodo
              </button>

              {/* Summary */}
              {governanceFteInfo.totalCost > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                  <div className="text-xs text-blue-700">
                    <div>FTE media: <strong>{(governanceFteInfo.totalFte / (current.governance_fte_periods || []).length).toFixed(2)}</strong></div>
                    <div>Tariffa media: <strong>€{governanceFteInfo.avgRate.toFixed(0)}/gg</strong></div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-blue-600">Costo Totale</div>
                    <div className="text-sm font-bold text-blue-700">
                      {formatCurrency(governanceFteInfo.totalCost)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE: MANUAL */}
          {current.governance_mode === 'manual' && (
            <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-2">
              <label className="text-xs font-medium text-blue-700">Costo Governance Manuale</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600">€</span>
                <input
                  type="number"
                  value={current.governance_cost_manual || 0}
                  onChange={(e) => handleFieldChange('governance_cost_manual', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  step={1000}
                  className="flex-1 px-3 py-2 text-right border border-blue-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* MODE: TEAM_MIX */}
          {current.governance_mode === 'team_mix' && (
            <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 uppercase">Mix Profili Governance</span>
                <span className="text-xs text-blue-600">
                  {governanceFteFromPct.toFixed(2)} FTE
                </span>
              </div>

              {(current.governance_profile_mix || []).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.lutech_profile}
                    onChange={(e) => handleUpdateGovProfile(idx, 'lutech_profile', e.target.value)}
                    disabled={disabled}
                    className="flex-1 px-2 py-1.5 border border-blue-200 rounded-md text-xs
                               focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Profilo --</option>
                    {practices.map(p => (
                      <optgroup key={p.id} label={p.label}>
                        {(p.profiles || []).map(prof => (
                          <option key={`${p.id}:${prof.id}`} value={`${p.id}:${prof.id}`}>
                            {prof.label} - €{prof.daily_rate}/gg
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={item.pct}
                    onChange={(e) => handleUpdateGovProfile(idx, 'pct', e.target.value)}
                    disabled={disabled}
                    min={0}
                    max={100}
                    step={5}
                    className="w-16 px-2 py-1.5 text-center text-xs border border-blue-200 rounded-md
                               focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-xs text-blue-600">%</span>
                  <button
                    onClick={() => handleRemoveGovProfile(idx)}
                    disabled={disabled}
                    className="p-1 text-blue-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                onClick={handleAddGovProfile}
                disabled={disabled}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                           text-blue-600 hover:bg-blue-100 rounded-md"
              >
                <Plus className="w-3 h-3" />
                Profilo
              </button>

              {/* Result */}
              {governanceMixInfo.avgRate > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                  <div className="text-xs text-blue-700">
                    <div>Tariffa media: <strong>€{governanceMixInfo.avgRate.toFixed(0)}/gg</strong></div>
                    <div className={governanceMixInfo.isComplete ? 'text-green-600' : 'text-amber-600'}>
                      Distribuzione: {governanceMixInfo.totalPct.toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-blue-600">Costo Calcolato</div>
                    <div className="text-sm font-bold text-blue-700">
                      {formatCurrency(calculatedGovernanceCostTeamMix)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Checkbox: Apply Reuse to Governance */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-200">
            <input
              type="checkbox"
              id="governance_apply_reuse"
              checked={current.governance_apply_reuse}
              onChange={(e) => handleFieldChange('governance_apply_reuse', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="governance_apply_reuse" className="text-xs text-blue-700 cursor-pointer">
              Applica fattore riuso alla governance
              {current.governance_apply_reuse && current.reuse_factor > 0 && (
                <span className="ml-1 text-emerald-600 font-semibold">
                  (-{current.reuse_factor}%)
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Risk Contingency */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            {t('business_plan.risk_contingency')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={current.risk_contingency_pct}
              onChange={(e) => handleChange('risk_contingency_pct', e.target.value)}
              disabled={disabled}
              className="w-20 px-3 py-2 text-center border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         disabled:bg-slate-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Fattore Riuso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              {t('business_plan.reuse_factor')}
            </label>
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 rounded-lg">
              <span className="text-sm font-semibold text-emerald-700">
                {current.reuse_factor}
              </span>
              <span className="text-xs text-emerald-600">%</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={current.reuse_factor}
            onChange={(e) => handleChange('reuse_factor', e.target.value)}
            disabled={disabled}
            className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer
                       accent-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>0%</span>
            <span>80%</span>
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
            <strong>Formula:</strong> Costo Effettivo = Costo Base × (1 - {current.reuse_factor}%) = Costo Base × {(1 - current.reuse_factor / 100).toFixed(2)}
          </p>
          <p className="text-xs text-slate-400 italic">
            Efficienza da riuso asset, know-how, acceleratori interni
          </p>
        </div>
      </div>
    </div>
  );
}
