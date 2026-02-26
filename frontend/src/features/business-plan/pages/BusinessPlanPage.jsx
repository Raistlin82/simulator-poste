import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { bpSaveTrigger } from '../../../utils/bpSaveTrigger';
import { useSimulation } from '../../simulation/context/SimulationContext';
import { useBusinessPlan } from '../context/BusinessPlanContext';
import { useConfig } from '../../config/context/ConfigContext';
import { useToast } from '../../../shared/hooks/useToast';
import axios from 'axios';
import { API_URL } from '../../../utils/api';
import { logger } from '../../../utils/logger';
import {
  Briefcase,
  Building2,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MailCheck,
  Users,
  BarChart3,
  Calendar,
  FileDown,
  FileUp,
} from 'lucide-react';

import {
  ParametersPanel,
  TeamCompositionTable,
  TowConfigTable,
  ProfileMappingEditor,
  PracticeCatalogManager,
  MarginSimulator,
  VolumeAdjustments,
  CostBreakdown,
  ProfitAndLoss,
  SubcontractPanel,
  OfferSchemeTable,
  TowAnalysis,
} from '../components';
import CatalogEditorModal from '../components/CatalogEditorModal';

import { calculateTeamCost, calculateGovernanceCost, calculateCatalogCost } from '../utils/businessPlanEngine';


import { DEFAULT_DAILY_RATE, DAYS_PER_FTE, SCENARIO_PARAMS } from '../constants';

export default function BusinessPlanPage() {
  const { t } = useTranslation();
  const { selectedLot, myDiscount } = useSimulation();
  const { config } = useConfig();
  const toast = useToast();
  const {
    businessPlan,
    practices,
    loading,
    error,
    saveBusinessPlan,
    savePractice,
    deletePractice,
    registerSaveTrigger,
  } = useBusinessPlan();

  const lotData = config && selectedLot ? config[selectedLot] : null;

  // Local state for editing
  const [localBP, setLocalBP] = useState(null);
  const [calcResult, setCalcResult] = useState(null);
  const [catalogModalTow, setCatalogModalTow] = useState(null); // { tow, index } | null
  const [cleanTeamCost, setCleanTeamCost] = useState(0);
  const [towBreakdown, setTowBreakdown] = useState({});
  const [lutechProfileBreakdown, setLutechProfileBreakdown] = useState({});
  const [intervals, setIntervals] = useState([]);
  const [teamMixRate, setTeamMixRate] = useState(0);
  const [discount, setDiscount] = useState(() => myDiscount ?? 0);
  const [targetMargin, setTargetMargin] = useState(15);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [excelExportLoading, setExcelExportLoading] = useState(false);
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('poste');

  const fileInputRef = useRef(null);

  // Build Lutech rates lookup from practices
  const buildLutechRates = useCallback(() => {
    const rates = {};
    const fallbackRate = localBP?.default_daily_rate || DEFAULT_DAILY_RATE;
    for (const practice of practices) {
      for (const profile of (practice.profiles || [])) {
        rates[`${practice.id}:${profile.id}`] = profile.daily_rate || fallbackRate;
      }
    }
    return rates;
  }, [practices, localBP]);

  const buildLutechLabels = useCallback(() => {
    const labels = {};
    for (const practice of practices) {
      for (const profile of (practice.profiles || [])) {
        labels[`${practice.id}:${profile.id}`] = {
          profile: profile.label || profile.id,
          practice: practice.label || practice.id
        };
      }
    }
    return labels;
  }, [practices]);

  // Sync discount with sidebar myDiscount whenever the selected lot or the
  // sidebar discount changes so the Margin box stays aligned with the sidebar.
  useEffect(() => {
    setDiscount(myDiscount ?? 0);
  }, [selectedLot, myDiscount]);

  // Initialize local state from fetched BP
  useEffect(() => {
    if (businessPlan) {
      // Convert decimals from API to percentages for UI display
      setLocalBP({
        ...businessPlan,
        governance_pct: (businessPlan.governance_pct || 0.04) * 100,
        risk_contingency_pct: (businessPlan.risk_contingency_pct || 0.03) * 100,
        reuse_factor: (businessPlan.reuse_factor || 0) * 100,
        days_per_fte: businessPlan.days_per_fte || DAYS_PER_FTE,
        default_daily_rate: businessPlan.default_daily_rate || DEFAULT_DAILY_RATE,
        governance_mode: businessPlan.governance_mode || 'percentage',
        governance_fte_periods: businessPlan.governance_fte_periods || [],
        governance_apply_reuse: businessPlan.governance_apply_reuse || false,
        governance_profile_mix: businessPlan.governance_profile_mix || [],
        governance_cost_manual: businessPlan.governance_cost_manual ?? null,
        margin_warning_threshold: businessPlan.margin_warning_threshold ?? 0.05,
        margin_success_threshold: businessPlan.margin_success_threshold ?? 0.15,
        inflation_pct: businessPlan.inflation_pct ?? 0,
        max_subcontract_pct: businessPlan.max_subcontract_pct ?? 20,
      });
    } else if (selectedLot) {
      // Initialize empty BP (values already in percentage form)
      const defaultDuration = 36;
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
      setLocalBP({
        duration_months: defaultDuration,
        start_year: currentYear,
        start_month: currentMonth,
        days_per_fte: DAYS_PER_FTE,
        default_daily_rate: DEFAULT_DAILY_RATE,
        governance_pct: 4,
        risk_contingency_pct: 3,
        reuse_factor: 0,
        team_composition: [],
        tows: [],
        volume_adjustments: { periods: [{ month_start: 1, month_end: defaultDuration, by_tow: {}, by_profile: {} }] },
        tow_assignments: {},
        profile_mappings: {},
        subcontract_config: {},
        governance_profile_mix: [],
        governance_cost_manual: null,
        governance_mode: 'percentage',
        governance_fte_periods: [],
        governance_apply_reuse: false,
        inflation_pct: 0,
        margin_warning_threshold: 0.05,
        margin_success_threshold: 0.15,
        max_subcontract_pct: 20,
      });
    }
  }, [businessPlan, selectedLot]);

  /**
   * Calculate team cost with explicit parameters.
   * Returns { total, byTow } where byTow is a {towId: cost} map.
   *
   * @param {object} bp - business plan data
   * @param {object} overrides - optional overrides for reuse_factor and volume_adjustments
   */
  const runCalculation = useCallback(() => {
    if (!localBP || !lotData) return;

    try {
      // Optimized team cost with TOW breakdown
      const teamResult = calculateTeamCost(localBP, buildLutechRates(), buildLutechLabels());
      const teamCost = teamResult.total;

      // Clean team cost (no optimizations)
      const cleanResult = calculateTeamCost(localBP, buildLutechRates(), buildLutechLabels(), {
        reuse_factor: 0,
        volume_adjustments: { periods: [{ month_start: 1, month_end: localBP.duration_months || 36, by_tow: {}, by_profile: {} }] },
      });

      // Catalog cost (margine-first, fisso dal bando — entra nella base overhead)
      const { total: catalogCost, detail: catalogDetail } = calculateCatalogCost(localBP, buildLutechRates());

      // Base overhead = team cost + catalog cost
      const baseCost = teamCost + catalogCost;

      // Governance (calcolata sulla base overhead completa)
      const govResult = calculateGovernanceCost(localBP, buildLutechRates(), baseCost);
      const governanceCost = govResult.value;

      // Risk (calcolato su base + governance)
      const riskPct = localBP.risk_contingency_pct || 0;
      const riskCost = Math.round((baseCost + governanceCost) * (riskPct / 100) * 100) / 100;

      // Subcontract (su base overhead)
      const towSplit = localBP.subcontract_config?.tow_split || {};
      const subQuotaPct = Object.values(towSplit).reduce((sum, pct) => sum + (parseFloat(pct) || 0), 0);
      const subcontractCost = Math.round(baseCost * (subQuotaPct / 100) * 100) / 100;
      const subAvgRate = localBP.subcontract_config?.avg_daily_rate ?? teamMixRate;
      const subPartner = localBP.subcontract_config?.partner || 'Non specificato';

      const totalCostRaw = baseCost + governanceCost + riskCost + subcontractCost;
      const totalCost = Math.round(totalCostRaw * 100) / 100;

      setCalcResult({
        team: teamCost,
        catalog_cost: catalogCost,
        catalog_detail: catalogDetail,
        governance: governanceCost,
        risk: riskCost,
        subcontract: subcontractCost,
        total: totalCost,
        explanation: {
          governance: govResult.meta,
          risk: { pct: riskPct, base: baseCost + governanceCost },
          subcontract: {
            pct: subQuotaPct,
            avg_daily_rate: subAvgRate,
            partner: subPartner
          }
        }
      });

      setCleanTeamCost(cleanResult.total);

      // Merge team TOW breakdown with catalog TOW breakdown
      const mergedTowBreakdown = { ...teamResult.byTow };
      if (catalogDetail?.byTow && Array.isArray(catalogDetail.byTow)) {
        for (const catalogTow of catalogDetail.byTow) {
          mergedTowBreakdown[catalogTow.tow_id] = {
            cost: catalogTow.cost,
            revenue: catalogTow.sell_price,
            label: catalogTow.label,
            type: 'catalogo'
          };
        }
      }
      setTowBreakdown(mergedTowBreakdown);

      setLutechProfileBreakdown(teamResult.byLutechProfile || {});
      setIntervals(teamResult.intervals || []);
      setTeamMixRate(teamResult.teamMixRate || 0);

      // Calculation completed
    } catch (err) {
      logger.error('Calculation error', err, { lot: selectedLot });
      toast.error(`Errore nel calcolo: ${err.message || 'Errore sconosciuto'}`);
    }
  }, [localBP, lotData, calculateTeamCost, calculateGovernanceCost, teamMixRate, toast, buildLutechRates, buildLutechLabels]);

  useEffect(() => {
    runCalculation();
  }, [runCalculation]);

  // Ref to always hold the latest handleSave (for registerSaveTrigger)
  const handleSaveRef = useRef(null);

  // Handle save
  const handleSave = async () => {
    if (!localBP) return;

    setSaving(true);
    setSaveStatus(null);

    try {
      // Convert percentages to decimals for API
      const dataToSave = {
        ...localBP,
        governance_pct: localBP.governance_pct / 100,
        risk_contingency_pct: localBP.risk_contingency_pct / 100,
        reuse_factor: localBP.reuse_factor / 100,
        days_per_fte: localBP.days_per_fte,
        default_daily_rate: localBP.default_daily_rate,
        // Ensure these fields are explicitly included
        margin_warning_threshold: localBP.margin_warning_threshold ?? 0.05,
        margin_success_threshold: localBP.margin_success_threshold ?? 0.15,
        inflation_pct: localBP.inflation_pct ?? 0,
      };

      await saveBusinessPlan(dataToSave);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      logger.error('Save error', err, { lot: selectedLot });
      const errorMsg = err.response?.data?.detail || err.message || 'Errore sconosciuto';
      toast.error(`Errore nel salvataggio: ${errorMsg}`);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Keep ref updated without re-registering on every render
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });
  // Register with singleton on mount; use a generation token so stale cleanup
  // cannot null-out a handler registered by a newer mount (e.g. React StrictMode double-invoke)
  useEffect(() => {
    const id = Symbol('bpSaveTrigger');
    bpSaveTrigger.fn = () => handleSaveRef.current?.();
    bpSaveTrigger._id = id;
    return () => {
      if (bpSaveTrigger._id === id) {
        bpSaveTrigger.fn = null;
        bpSaveTrigger._id = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRti = lotData?.rti_enabled || false;
  const quotaLutech = isRti && lotData?.rti_quotas?.Lutech
    ? lotData.rti_quotas.Lutech / 100
    : 1.0;

  const handleExcelExport = async () => {
    if (!localBP || !lotData || !calcResult) return;

    setExcelExportLoading(true);
    try {
      const res = await axios.post(`${API_URL}/business-plan-export`, {
        lot_key: selectedLot,
        business_plan: {
          ...localBP,
          governance_pct: localBP.governance_pct / 100,
          risk_contingency_pct: localBP.risk_contingency_pct / 100,
          reuse_factor: localBP.reuse_factor / 100,
        },
        costs: calcResult,
        clean_team_cost: cleanTeamCost,
        base_amount: lotData.base_amount || 0,
        is_rti: isRti,
        quota_lutech: quotaLutech,
        tow_breakdown: towBreakdown,
        lutech_breakdown: lutechProfileBreakdown,
        profile_rates: buildLutechRates(),
        profile_labels: buildLutechLabels(),
        intervals: intervals,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `business_plan_${selectedLot.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      logger.error('Excel Export Error', err, { lot: selectedLot });
      toast.error(`Errore nell'export Excel: ${err.message || 'Errore sconosciuto'}`);
      setSaveStatus('error');
    } finally {
      setExcelExportLoading(false);
    }
  };

  const handleExcelImport = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedLot) return;

    setExcelImportLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/business-plan/${encodeURIComponent(selectedLot)}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        toast.success(res.data.message || 'Importazione completata con successo');
        if (res.data.bp) {
          // Sync state with imported DB BP
          setLocalBP({
            ...res.data.bp,
            governance_pct: (res.data.bp.governance_pct || 0.04) * 100,
            risk_contingency_pct: (res.data.bp.risk_contingency_pct || 0.03) * 100,
            reuse_factor: (res.data.bp.reuse_factor || 0) * 100,
            days_per_fte: res.data.bp.days_per_fte || DAYS_PER_FTE,
            default_daily_rate: res.data.bp.default_daily_rate || DEFAULT_DAILY_RATE,
            governance_mode: res.data.bp.governance_mode || 'percentage',
            governance_fte_periods: res.data.bp.governance_fte_periods || [],
            governance_apply_reuse: res.data.bp.governance_apply_reuse || false,
            governance_profile_mix: res.data.bp.governance_profile_mix || [],
            governance_cost_manual: res.data.bp.governance_cost_manual ?? null,
            margin_warning_threshold: res.data.bp.margin_warning_threshold ?? 0.05,
            margin_success_threshold: res.data.bp.margin_success_threshold ?? 0.15,
            inflation_pct: res.data.bp.inflation_pct ?? 0,
            max_subcontract_pct: res.data.bp.max_subcontract_pct ?? 20,
          });
        }
      } else {
        toast.error(res.data.message || "Errore nell'importazione");
      }
    } catch (err) {
      logger.error('Excel Import Error', err, { lot: selectedLot });
      const errorMsg = err.response?.data?.detail || err.message || 'Errore sconosciuto';
      toast.error(`Errore nell'import Excel: ${errorMsg}`);
    } finally {
      setExcelImportLoading(false);
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Update handlers
  const handleTeamChange = (team) => {
    setLocalBP(prev => ({ ...prev, team_composition: team }));
  };

  const handleTowsChange = (tows) => {
    setLocalBP(prev => ({ ...prev, tows }));
  };

  const handleTowAssignmentChange = (assignments) => {
    setLocalBP(prev => ({ ...prev, tow_assignments: assignments }));
  };

  const handleVolumeAdjustmentsChange = (adjustments) => {
    setLocalBP(prev => ({ ...prev, volume_adjustments: adjustments }));
  };

  const handleProfileMappingsChange = (mappings) => {
    setLocalBP(prev => ({ ...prev, profile_mappings: mappings }));
  };

  const handleParametersChange = (params) => {
    setLocalBP(prev => ({
      ...prev,
      ...params
    }));
  };

  const handleDurationChange = (months) => {
    const newDuration = parseFloat(months) || 36;
    setLocalBP(prev => {
      // Update duration_months and adjust volume_adjustments if needed
      const volumeAdj = prev.volume_adjustments || {};
      const periods = volumeAdj.periods || [];
      const oldDuration = prev.duration_months || 36;

      // Update all periods, removing those that start after new duration
      let updatedPeriods = periods
        .map(period => {
          // Se il periodo inizia dopo la nuova durata, scartalo
          if ((period.month_start || 1) > newDuration) {
            return null;
          }

          // Se il periodo finiva con la vecchia durata, estendilo alla nuova
          if (period.month_end === oldDuration) {
            return { ...period, month_end: newDuration };
          }

          // Se il periodo eccede la nuova durata, clampalo
          if (period.month_end > newDuration) {
            return { ...period, month_end: newDuration };
          }

          return period;
        })
        .filter(Boolean); // Rimuovi periodi null

      // Se non ci sono più periodi validi, crea un periodo default
      if (updatedPeriods.length === 0) {
        updatedPeriods = [{
          month_start: 1,
          month_end: newDuration,
          by_tow: {},
          by_profile: {}
        }];
      }

      return {
        ...prev,
        duration_months: newDuration,
        volume_adjustments: {
          ...volumeAdj,
          periods: updatedPeriods
        }
      };
    });
  };

  const handleDaysPerFteChange = (days) => {
    setLocalBP(prev => ({ ...prev, days_per_fte: parseFloat(days) || DAYS_PER_FTE }));
  };

  const handleMaxSubcontractPctChange = (val) => {
    setLocalBP(prev => ({ ...prev, max_subcontract_pct: parseFloat(val) || 20 }));
  };

  const handleDefaultRateChange = (rate) => {
    setLocalBP(prev => ({ ...prev, default_daily_rate: parseFloat(rate) || DEFAULT_DAILY_RATE }));
  };

  const handleStartYearChange = (year) => {
    setLocalBP(prev => ({ ...prev, start_year: parseInt(year) || null }));
  };

  const handleStartMonthChange = (month) => {
    setLocalBP(prev => ({ ...prev, start_month: parseInt(month) || null }));
  };

  // Calcola data fine e anni interessati
  const getContractPeriodInfo = () => {
    if (!localBP?.start_year || !localBP?.start_month || !localBP?.duration_months) {
      return null;
    }

    const startYear = localBP.start_year;
    const startMonth = localBP.start_month;
    const durationMonths = localBP.duration_months;

    // Calcola data fine
    const totalMonths = startMonth + durationMonths - 1;
    const endYear = startYear + Math.floor((totalMonths - 1) / 12);
    const endMonth = ((totalMonths - 1) % 12) + 1;

    // Calcola anni interessati
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    return {
      startYear,
      startMonth,
      endYear,
      endMonth,
      years,
      yearsCount: years.length
    };
  };

  const handleSubcontractChange = (subConfig) => {
    setLocalBP(prev => ({ ...prev, subcontract_config: subConfig }));
  };

  // Apply optimization proposal (juniorization)
  const handleApplyOptimization = (proposal) => {
    if (!proposal?.profileId) return;

    const profileId = proposal.profileId;
    const currentMappings = { ...(localBP.profile_mappings || {}) };
    const profileMapping = currentMappings[profileId] || [];

    if (profileMapping.length === 0) {
      // No mapping exists, cannot apply optimization
      return;
    }

    // Build a lookup of Lutech profile seniority from practices
    const lutechSeniority = {};
    (practices || []).forEach(practice => {
      (practice.profiles || []).forEach(profile => {
        const fullId = `${practice.id}:${profile.id}`;
        lutechSeniority[fullId] = profile.seniority || 'mid';
      });
    });

    // Update each period in the mapping
    const updatedMapping = profileMapping.map(period => {
      const currentMix = period.mix || [];
      if (currentMix.length === 0) return period;

      // Find senior and junior profiles in the mix
      let seniorProfiles = [];
      let juniorProfiles = [];

      currentMix.forEach(m => {
        const seniority = lutechSeniority[m.lutech_profile] || 'mid';
        if (seniority === 'sr' || seniority === 'senior' || seniority === 'expert') {
          seniorProfiles.push(m);
        } else if (seniority === 'jr' || seniority === 'junior') {
          juniorProfiles.push(m);
        }
      });

      // If no senior or no junior profiles, cannot optimize
      if (seniorProfiles.length === 0 || juniorProfiles.length === 0) {
        // Try mid profiles as target for junior replacement
        const midProfiles = currentMix.filter(m => {
          const s = lutechSeniority[m.lutech_profile] || 'mid';
          return s === 'mid';
        });
        if (seniorProfiles.length === 0 || midProfiles.length === 0) {
          return period;
        }
        juniorProfiles = midProfiles;
      }

      // Calculate transfer amount (30% of total senior pct)
      const totalSeniorPct = seniorProfiles.reduce((sum, m) => sum + (m.pct || 0), 0);
      const transferPct = Math.min(totalSeniorPct * 0.3, totalSeniorPct); // Transfer 30%

      if (transferPct < 1) return period; // Too small to matter

      // Create new mix with adjusted percentages
      const newMix = currentMix.map(m => {
        const seniority = lutechSeniority[m.lutech_profile] || 'mid';
        const isSenior = seniority === 'sr' || seniority === 'senior' || seniority === 'expert';
        const isJunior = seniority === 'jr' || seniority === 'junior' || seniority === 'mid';

        if (isSenior && seniorProfiles.length > 0) {
          // Reduce senior by their proportion of transfer
          const proportion = (m.pct || 0) / totalSeniorPct;
          const reduction = transferPct * proportion;
          return { ...m, pct: Math.max(0, (m.pct || 0) - reduction) };
        } else if (isJunior && juniorProfiles.some(j => j.lutech_profile === m.lutech_profile)) {
          // Increase junior by their proportion
          const totalJuniorPct = juniorProfiles.reduce((sum, j) => sum + (j.pct || 0), 0);
          const proportion = totalJuniorPct > 0 ? (m.pct || 0) / totalJuniorPct : 1 / juniorProfiles.length;
          const increase = transferPct * proportion;
          return { ...m, pct: (m.pct || 0) + increase };
        }
        return m;
      });

      // Normalize to 100% and round
      const total = newMix.reduce((sum, m) => sum + (m.pct || 0), 0);
      const normalizedMix = newMix.map(m => ({
        ...m,
        pct: Math.round((m.pct || 0) * 100 / total)
      }));

      // Adjust for rounding errors
      const normalizedTotal = normalizedMix.reduce((sum, m) => sum + m.pct, 0);
      if (normalizedTotal !== 100 && normalizedMix.length > 0) {
        normalizedMix[0].pct += (100 - normalizedTotal);
      }

      return { ...period, mix: normalizedMix };
    });

    currentMappings[profileId] = updatedMapping;
    setLocalBP(prev => ({ ...prev, profile_mappings: currentMappings }));
  };



  // Base d'asta effettiva per Lutech: se RTI, e gia la quota Lutech
  const effectiveBaseAmount = (lotData?.base_amount || 0) * quotaLutech;

  // Calculate Offer Scheme Data (PxQ)
  const calculateOfferData = useCallback(() => {
    if (!calcResult || !localBP || !lotData) return { data: [], total: 0 };

    // Revenue Target (Base d'asta effettiva - Sconto)
    // Use the same quotaLutech already computed at component level (avoids duplication)
    const effectiveBase = (lotData.base_amount || 0) * quotaLutech;
    const revenue = effectiveBase * (1 - discount / 100);

    const tows = localBP.tows || [];

    // ALIGNED with TowAnalysis: Revenue allocation based on WEIGHT (not cost)
    // This ensures consistency between Offer Schema and TOW Margin Analysis
    const totalWeight = tows.reduce((sum, t) => sum + (parseFloat(t.weight_pct) || 0), 0) || 100;

    // 4. Ripartisci Revenue su base Peso (ALLINEATO con Analisi Margine per TOW)
    const offerData = [];
    let checkTotal = 0;

    for (const tow of tows) {
      const towId = tow.tow_id;

      // TOW Catalogo: usa pricing dal modello FTE-from-group (già calcolato in catalog_detail)
      if (tow.type === 'catalogo') {
        const items = tow.catalog_items || [];
        const groups = tow.catalog_groups || [];

        // Recupera i valori calcolati da calcResult.catalog_detail per evitare doppio calcolo
        // Lookup per tow_id (fallback a label per backward compat)
        const towDetail = (calcResult.catalog_detail?.byTow || []).find(
          d => (tow.tow_id && d.tow_id === tow.tow_id) || d.label === (tow.label || tow.tow_id || 'Catalogo')
        );
        const itemDetailMap = {};
        if (towDetail) {
          items.forEach((it, i) => {
            if (towDetail.items[i]) itemDetailMap[it.id] = towDetail.items[i];
          });
        }

        // Prezzo catalogo = Σ lutech_revenue (Prezzo Vendita Tot. per voce)
        const catalogTotal = towDetail ? towDetail.sell_price : 0;

        const itemMap = Object.fromEntries(items.map(it => [it.id, it]));
        const groupedIds = new Set(groups.flatMap(g => g.item_ids || []));

        const mapItem = (it) => {
          const detail = itemDetailMap[it.id] || {};
          return {
            id: it.id,
            label: it.label,
            price_base: parseFloat(it.price_base) || 0,
            group_pct: parseFloat(it.group_pct) || 0,
            fte: detail.fte ?? 0,
            lutech_cost: detail.lutech_cost ?? 0,
            lutech_unit_price: detail.lutech_unit_price ?? 0,
            poste_total: detail.poste_total ?? 0,
            sconto_pct: detail.sconto_pct ?? 0,
            effective_margin_pct: detail.effective_margin_pct ?? 0,
            total: detail.lutech_revenue ?? 0,  // Prezzo Vendita Tot.
          };
        };

        const catalogGroups = groups.map(g => ({
          id: g.id,
          label: g.label,
          target_value: parseFloat(g.target_value) || 0,
          items: (g.item_ids || []).map(id => itemMap[id]).filter(Boolean).map(mapItem),
        }));

        const ungrouped = items.filter(it => !groupedIds.has(it.id)).map(mapItem);

        offerData.push({
          tow_id: towId,
          label: tow.label,
          type: 'catalogo',
          quantity: items.length,
          unit_price: null,
          total_price: catalogTotal,
          catalog_detail: { groups: catalogGroups, ungrouped },
        });
        checkTotal += catalogTotal;
        continue;
      }

      // Revenue allocation based on WEIGHT (aligned with TowAnalysis)
      const weight = (parseFloat(tow.weight_pct) || 0) / totalWeight;
      const totalPrice = revenue * weight;

      // Quantità
      let quantity = 0;
      if (tow.type === 'task') {
        quantity = parseInt(tow.num_tasks) || 0;
      } else if (tow.type === 'corpo' || tow.type === 'canone') {
        quantity = parseInt(tow.duration_months) || parseInt(localBP.duration_months) || 36;
      } else {
        quantity = 1; // Consumo default
      }

      // Prezzo unitario
      const unitPrice = quantity > 0 ? totalPrice / quantity : 0;

      offerData.push({
        tow_id: towId,
        label: tow.label,
        type: tow.type,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      });

      checkTotal += totalPrice;
    }

    return { data: offerData, total: checkTotal };

  }, [calcResult, localBP, lotData, discount, towBreakdown, isRti]);

  // Loading state
  if (!selectedLot || !lotData) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
              <Briefcase className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">
              {t('business_plan.title')}
            </h2>
            <p className="text-slate-500 max-w-md">
              {t('business_plan.no_lot_selected')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !localBP) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-64 bg-slate-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const offerScheme = calculateOfferData();

  return (
    <>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 font-display tracking-tightest">
                  {t('business_plan.title')}
                </h1>
                <p className="text-sm font-medium text-slate-500 tracking-tight">
                  {t('business_plan.subtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-white/50 backdrop-blur-md text-slate-800 text-xs font-black uppercase tracking-widest rounded-xl border border-white/40 shadow-sm font-display">
                {selectedLot}
              </span>
              {isRti && (
                <span className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-500/10 backdrop-blur-md text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-200/50 font-display">
                  <Building2 className="w-3 h-3" />
                  RTI {quotaLutech * 100}%
                </span>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={excelImportLoading || !calcResult}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-medium text-sm shadow-sm"
              >
                {excelImportLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileUp className="w-4 h-4" />
                )}
                Importa Excel
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelImport}
                className="hidden"
                accept=".xlsx"
              />
              <button
                onClick={handleExcelExport}
                disabled={excelExportLoading || !calcResult}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl
                  hover:bg-slate-800 transition-all font-medium text-sm shadow-md"
              >
                {excelExportLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                Esporta Excel
              </button>
            </div>
          </div>

          {/* Save status */}
          {saveStatus && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${saveStatus === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
              {saveStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {saveStatus === 'success' ? 'Business Plan salvato con successo' : 'Errore nel salvataggio'}
              </span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex bg-white/30 backdrop-blur-xl border border-white/40 p-1.5 rounded-2xl shadow-sm">
            {[
              { id: 'poste', label: 'Poste', icon: MailCheck, desc: 'Requisiti' },
              { id: 'lutech', label: 'Lutech', icon: Users, desc: 'Team' },
              { id: 'analisi', label: 'Analisi', icon: BarChart3, desc: 'P&L' },
              { id: 'offerta', label: 'Offerta', icon: FileDown, desc: 'PxQ' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl
                         transition-all duration-300 ${activeTab === tab.id
                    ? 'bg-white text-indigo-600 shadow-md scale-[1.02]'
                    : 'text-slate-500 hover:text-indigo-500 hover:bg-white/50'
                  }`}
              >
                <tab.icon className={`w-5 h-5 transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`} />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest font-display">{tab.label}</span>
                  <span className="hidden md:inline text-[8px] font-bold text-slate-400 uppercase tracking-widest-plus mt-0.5">{tab.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">

            {/* ═══ TAB 1: POSTE ═══ */}
            {activeTab === 'poste' && (
              <div className="space-y-6">
                {/* Configurazione TOW */}
                <TowConfigTable
                  tows={localBP.tows || []}
                  practices={practices}
                  towAssignments={localBP.tow_assignments || {}}
                  onChange={handleTowsChange}
                  onAssignmentChange={handleTowAssignmentChange}
                  onOpenCatalogModal={(towIndex) => {
                    const tow = (localBP.tows || [])[towIndex];
                    if (tow) {
                      // Ensure Sconto Gara/Lotto is initially aligned with the
                      // global discount (sidebar) when not explicitly set.
                      const sconto = tow.sconto_gara_pct;
                      if (sconto === undefined || sconto === null || Number(sconto) === 0) {
                        const normalized = parseFloat(discount) || 0;
                        const towCopy = { ...tow, sconto_gara_pct: normalized };
                        setCatalogModalTow({ tow: towCopy, index: towIndex });
                      } else {
                        setCatalogModalTow({ tow, index: towIndex });
                      }
                    }
                  }}
                  volumeAdjustments={localBP.volume_adjustments || {}}
                  durationMonths={localBP.duration_months}
                  profileMappings={localBP.profile_mappings || {}}
                  profileRates={buildLutechRates()}
                  defaultDailyRate={localBP.default_daily_rate || DEFAULT_DAILY_RATE}
                  daysPerFte={localBP.days_per_fte || DAYS_PER_FTE}
                />

                {/* Composizione Team (requisiti Poste) — i TOW tipo catalogo non partecipano all'allocazione FTE */}
                <TeamCompositionTable
                  team={localBP.team_composition || []}
                  tows={(localBP.tows || []).filter(t => t.type !== 'catalogo')}
                  durationMonths={localBP.duration_months}
                  daysPerFte={localBP.days_per_fte || DAYS_PER_FTE}
                  onChange={handleTeamChange}
                  volumeAdjustments={localBP.volume_adjustments || {}}
                  reuseFactor={localBP.reuse_factor || 0}
                />

                {/* Parametri Poste: Durata + Rettifica Volumi */}
                <div className="glass-card rounded-2xl">
                  <div className="p-4 glass-card-header">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-800 font-display tracking-tight uppercase">Parametri Poste</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">Durata, giorni/anno FTE, tariffa default e rettifica volumi</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Data Inizio Contratto */}
                    <div className="pb-4 border-b border-slate-100">
                      <label className="text-sm font-medium text-slate-700 mb-3 block">Data Inizio Contratto</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Anno */}
                        <div className="space-y-2">
                          <label className="text-xs text-slate-500">Anno</label>
                          <input
                            type="number"
                            min={2020}
                            max={2040}
                            value={localBP.start_year || ''}
                            onChange={(e) => handleStartYearChange(e.target.value)}
                            placeholder="es. 2026"
                            className="w-full px-3 py-2 text-center border border-slate-200 rounded-lg
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        {/* Mese */}
                        <div className="space-y-2">
                          <label className="text-xs text-slate-500">Mese</label>
                          <select
                            value={localBP.start_month || ''}
                            onChange={(e) => handleStartMonthChange(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Seleziona...</option>
                            <option value="1">Gennaio</option>
                            <option value="2">Febbraio</option>
                            <option value="3">Marzo</option>
                            <option value="4">Aprile</option>
                            <option value="5">Maggio</option>
                            <option value="6">Giugno</option>
                            <option value="7">Luglio</option>
                            <option value="8">Agosto</option>
                            <option value="9">Settembre</option>
                            <option value="10">Ottobre</option>
                            <option value="11">Novembre</option>
                            <option value="12">Dicembre</option>
                          </select>
                        </div>

                        {/* Info calcolate */}
                        {(() => {
                          const periodInfo = getContractPeriodInfo();
                          if (!periodInfo) return null;

                          const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

                          return (
                            <div className="space-y-2">
                              <label className="text-xs text-slate-500">Periodo Contratto</label>
                              <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 text-sm font-medium">
                                {monthNames[periodInfo.startMonth - 1]} {periodInfo.startYear} → {monthNames[periodInfo.endMonth - 1]} {periodInfo.endYear}
                              </div>
                              <div className="text-xs text-slate-500">
                                {periodInfo.yearsCount} ann{periodInfo.yearsCount > 1 ? 'i' : 'o'} interessat{periodInfo.yearsCount > 1 ? 'i' : 'o'}: {periodInfo.years.join(', ')}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Parametri base (griglia orizzontale) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Durata (mesi) */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Durata Contratto</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={12}
                            max={60}
                            value={localBP.duration_months || 36}
                            onChange={(e) => handleDurationChange(e.target.value)}
                            className="w-20 px-3 py-2 text-center border border-slate-200 rounded-lg
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-sm text-slate-500">mesi</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          ({((localBP.duration_months || 36) / 12).toFixed(1)} anni)
                        </div>
                      </div>

                      {/* Giorni anno FTE */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Giorni/anno FTE</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={180}
                            max={260}
                            value={localBP.days_per_fte || DAYS_PER_FTE}
                            onChange={(e) => handleDaysPerFteChange(e.target.value)}
                            className="w-20 px-3 py-2 text-center border border-slate-200 rounded-lg
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-sm text-slate-500">gg</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          (giorni lavorativi/anno)
                        </div>
                      </div>

                      {/* Tariffa giornaliera default */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Tariffa Default</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={localBP.default_daily_rate || DEFAULT_DAILY_RATE}
                            onChange={(e) => handleDefaultRateChange(e.target.value)}
                            className="w-24 px-3 py-2 text-right border border-slate-200 rounded-lg
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-sm text-slate-500">€/gg</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          (tariffa giornaliera)
                        </div>
                      </div>

                      {/* Max Subappalto % */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Max Subappalto</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={localBP.max_subcontract_pct ?? 20}
                            onChange={(e) => handleMaxSubcontractPctChange(e.target.value)}
                            className="w-20 px-3 py-2 text-center border border-slate-200 rounded-lg
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-sm text-slate-500">%</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          (limite massimo consentito)
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Rettifica Volumi - Spostato fuori da Parametri Poste */}
                <VolumeAdjustments
                  adjustments={localBP.volume_adjustments || {}}
                  team={localBP.team_composition || []}
                  tows={localBP.tows || []}
                  durationMonths={localBP.duration_months}
                  onChange={handleVolumeAdjustmentsChange}
                />
              </div>
            )}

            {/* ═══ TAB 2: LUTECH ═══ */}
            {activeTab === 'lutech' && (
              <div className="space-y-6">
                {/* Catalogo Profili Lutech */}
                <PracticeCatalogManager
                  practices={practices}
                  onSavePractice={savePractice}
                  onDeletePractice={deletePractice}
                />

                {/* Profile Mapping */}
                <ProfileMappingEditor
                  teamComposition={localBP.team_composition || []}
                  practices={practices}
                  mappings={localBP.profile_mappings || {}}
                  durationMonths={localBP.duration_months}
                  daysPerFte={localBP.days_per_fte || DAYS_PER_FTE}
                  onChange={handleProfileMappingsChange}
                  volumeAdjustments={localBP.volume_adjustments || {}}
                  reuseFactor={localBP.reuse_factor || 0}
                  tows={localBP.tows || []}
                  defaultDailyRate={localBP.default_daily_rate || DEFAULT_DAILY_RATE}
                  inflationPct={localBP.inflation_pct || 0}
                />

                {/* Subappalto */}
                <SubcontractPanel
                  config={localBP.subcontract_config || {}}
                  tows={localBP.tows || []}
                  teamCost={calcResult?.team || 0}
                  teamMixRate={teamMixRate}
                  defaultDailyRate={localBP.default_daily_rate || DEFAULT_DAILY_RATE}
                  maxSubcontractPct={localBP.max_subcontract_pct ?? 20}
                  onChange={handleSubcontractChange}
                />

                {/* Parametri Generali */}
                <ParametersPanel
                  values={{
                    governance_pct: localBP.governance_pct,
                    risk_contingency_pct: localBP.risk_contingency_pct,
                    reuse_factor: localBP.reuse_factor,
                    governance_profile_mix: localBP.governance_profile_mix || [],
                    governance_cost_manual: localBP.governance_cost_manual ?? null,
                    governance_mode: localBP.governance_mode || 'percentage',
                    governance_fte_periods: localBP.governance_fte_periods || [],
                    governance_apply_reuse: localBP.governance_apply_reuse || false,
                    inflation_pct: localBP.inflation_pct ?? 0,
                  }}
                  practices={practices}
                  totalTeamFte={(localBP.team_composition || []).reduce((sum, m) => sum + (parseFloat(m.fte) || 0), 0)}
                  teamCost={cleanTeamCost || 0}
                  durationMonths={localBP.duration_months}
                  daysPerFte={localBP.days_per_fte || DAYS_PER_FTE}
                  onChange={handleParametersChange}
                />

                {/* Breakdown Costi */}
                <CostBreakdown
                  costs={calcResult || {}}
                  towBreakdown={towBreakdown}
                  lutechProfileBreakdown={lutechProfileBreakdown}
                  teamMixRate={teamMixRate}
                  showTowDetail={Object.keys(towBreakdown).length > 0}
                  durationMonths={localBP.duration_months}
                  startYear={localBP.start_year}
                  startMonth={localBP.start_month}
                  inflationPct={localBP.inflation_pct ?? 0}
                  catalogCost={calcResult?.catalog_cost ?? 0}
                  catalogDetail={calcResult?.catalog_detail ?? null}
                />
              </div>
            )}

            {/* ═══ TAB 3: ANALISI ═══ */}
            {activeTab === 'analisi' && (
              <div className="space-y-6">
                {/* Analisi TOW e Proposte di Ottimizzazione */}
                <TowAnalysis
                  tows={localBP.tows || []}
                  towBreakdown={towBreakdown}
                  teamComposition={localBP.team_composition || []}
                  profileMappings={localBP.profile_mappings || {}}
                  practices={practices}
                  costs={calcResult || {}}
                  baseAmount={effectiveBaseAmount}
                  discount={discount}
                  daysPerFte={localBP.days_per_fte || DAYS_PER_FTE}
                  defaultDailyRate={localBP.default_daily_rate || DEFAULT_DAILY_RATE}
                  durationMonths={localBP.duration_months || 36}
                  onApplyOptimization={handleApplyOptimization}
                />

                {/* Conto Economico di Commessa */}
                <ProfitAndLoss
                  baseAmount={effectiveBaseAmount}
                  discount={discount}
                  isRti={isRti}
                  quotaLutech={quotaLutech}
                  fullBaseAmount={lotData.base_amount || 0}
                  costs={calcResult || {}}
                  cleanTeamCost={cleanTeamCost}
                  targetMargin={targetMargin}
                  riskContingency={localBP.risk_contingency_pct || 3}
                />

                {/* Margine */}
                <MarginSimulator
                  baseAmount={effectiveBaseAmount}
                  totalCost={calcResult?.total || 0}
                  isRti={isRti}
                  quotaLutech={quotaLutech}
                  discount={discount}
                  onDiscountChange={setDiscount}
                  targetMargin={targetMargin}
                  onTargetMarginChange={setTargetMargin}
                  riskContingency={localBP.risk_contingency_pct || 3}
                />


              </div>
            )}

            {/* ═══ TAB 4: OFFERTA ═══ */}
            {activeTab === 'offerta' && (
              <div className="space-y-6">
                <OfferSchemeTable
                  offerData={offerScheme.data}
                  totalOffer={offerScheme.total}
                />

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                  <strong>Nota:</strong> I prezzi unitari sono calcolati ripartendo l'importo totale dell'offerta (Revenue)
                  in proporzione al costo pieno di ogni TOW (Team + Governance + Risk + Subappalto).
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Catalog Editor Modal */}
      {catalogModalTow && localBP && (
        <CatalogEditorModal
          tow={catalogModalTow.tow}
          onChange={(updatedTow) => {
            const index = catalogModalTow.index; // constant while modal is open
            setLocalBP(prev => ({
              ...prev,
              tows: (prev.tows || []).map((t, i) => i === index ? updatedTow : t),
            }));
            setCatalogModalTow(prev => ({ ...prev, tow: updatedTow }));
          }}
          profileMappings={localBP.profile_mappings || {}}
          profileRates={buildLutechRates()}
          teamComposition={localBP.team_composition || []}
          durationMonths={localBP.duration_months || 36}
          defaultDailyRate={localBP.default_daily_rate || DEFAULT_DAILY_RATE}
          daysPerFte={localBP.days_per_fte || DAYS_PER_FTE}
          onClose={() => setCatalogModalTow(null)}
        />
      )}
    </>
  );
}
