import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus, Trash2, GripVertical, Percent, Save, X, TrendingDown, Info, AlertTriangle, BookOpen, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

/**
 * TowConfigTable - Configurazione Type of Work
 * Gestisce: TOW ID, label, tipo, peso %, attività, deliverables
 */
export default function TowConfigTable({
  tows = [],
  practices = [],
  towAssignments = {},
  onChange,
  onAssignmentChange,
  onOpenCatalogModal,
  volumeAdjustments = {},
  durationMonths = 36,
  disabled = false,
  // For catalog preview calculations
  profileMappings = {},
  profileRates = {},
  defaultDailyRate = 250,
  daysPerFte = 220,
}) {
  const { t } = useTranslation();
  const [showAddRow, setShowAddRow] = useState(false);
  const [expandedCatalog, setExpandedCatalog] = useState(new Set());
  const [newTow, setNewTow] = useState({
    tow_id: '',
    label: '',
    type: 'task',
    weight_pct: 0,
    num_tasks: 0,
    duration_months: 0,
    activities: '',
    deliverables: ''
  });

  const towTypes = [
    { value: 'task', label: 'Task', color: 'blue' },
    { value: 'corpo', label: 'A Corpo', color: 'purple' },
    { value: 'consumo', label: 'A Consumo', color: 'amber' },
    { value: 'canone', label: 'Canone Mensile', color: 'green' },
    { value: 'catalogo', label: 'Catalogo', color: 'rose' },
  ];

  const toggleCatalogExpand = (idx) => {
    const next = new Set(expandedCatalog);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setExpandedCatalog(next);
  };

  const handleAddTow = () => {
    if (!newTow.tow_id.trim() || !newTow.label.trim()) return;

    onChange?.([...tows, { ...newTow }]);
    setNewTow({
      tow_id: '',
      label: '',
      type: 'task',
      weight_pct: 0,
      num_tasks: 0,
      duration_months: 0,
      activities: '',
      deliverables: ''
    });
    setShowAddRow(false);
  };

  const handleRemoveTow = (index) => {
    const updated = tows.filter((_, i) => i !== index);
    onChange?.(updated);
  };

  const handleUpdateTow = (index, field, value) => {
    let processed = value;
    if (field === 'weight_pct') {
      processed = Math.min(100, Math.max(0, parseFloat(value) || 0));
    } else if (field === 'num_tasks' || field === 'duration_months') {
      processed = Math.max(0, parseInt(value) || 0);
    }
    const updated = tows.map((t, i) => {
      if (i !== index) return t;
      return { ...t, [field]: processed };
    });
    onChange?.(updated);
  };

  const handlePracticeAssignment = (towId, practiceId) => {
    onAssignmentChange?.({
      ...towAssignments,
      [towId]: practiceId
    });
  };

  // Calcola totale pesi
  const totalWeight = tows.reduce((sum, t) => sum + (parseFloat(t.weight_pct) || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.1;

  const getTypeStyle = (type) => {
    const t = towTypes.find(tt => tt.value === type);
    if (!t) return 'bg-slate-100 text-slate-600';
    const colors = {
      blue: 'bg-blue-100 text-blue-700',
      purple: 'bg-purple-100 text-purple-700',
      amber: 'bg-amber-100 text-amber-700',
      green: 'bg-green-100 text-green-700',
      rose: 'bg-rose-100 text-rose-700',
    };
    return colors[t.color] || 'bg-slate-100 text-slate-600';
  };

  // Compute catalog item rate — duration-weighted average across all mapping periods (full version)
  const computeCatalogItemRate = (profileMix) => {
    if (!profileMix || profileMix.length === 0) return defaultDailyRate;
    let totalWeighted = 0;
    let totalPct = 0;
    for (const entry of profileMix) {
      const pct = (parseFloat(entry.pct) || 0) / 100;
      if (pct <= 0) continue;
      const mappings = profileMappings[entry.poste_profile];
      let lutech_rate = defaultDailyRate;
      if (mappings && mappings.length > 0) {
        let periodWeighted = 0, periodMonthsTotal = 0;
        for (const m of mappings) {
          const ms = parseFloat(m.month_start ?? 1);
          const me = parseFloat(m.month_end ?? durationMonths);
          const months = Math.max(0, me - ms + 1);
          if (months <= 0) continue;
          let pRate = 0;
          for (const mi of (m.mix || [])) {
            const mpct = (parseFloat(mi.pct) || 0) / 100;
            pRate += mpct * (profileRates[mi.lutech_profile] || defaultDailyRate);
          }
          periodWeighted += pRate * months;
          periodMonthsTotal += months;
        }
        lutech_rate = periodMonthsTotal > 0 ? periodWeighted / periodMonthsTotal : defaultDailyRate;
        if (lutech_rate <= 0) lutech_rate = defaultDailyRate;
      } else {
        lutech_rate = profileRates[entry.poste_profile] || defaultDailyRate;
      }
      totalWeighted += pct * lutech_rate;
      totalPct += pct;
    }
    return totalPct > 0 ? totalWeighted / totalPct : defaultDailyRate;
  };

  // Calcola riduzioni TOW per periodo
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const adjustedQtyMap = useMemo(() => {
    const result = {};
    const periods = volumeAdjustments?.periods || [];
    if (periods.length === 0) return result;

    for (const tow of tows) {
      if (!tow.tow_id) continue;

      let totalMonths = 0;
      let weightedFactor = 0;
      const periodDetails = [];
      const qty = tow.type === 'task' ? (tow.num_tasks || 0) : (tow.type === 'consumo' ? 0 : (tow.duration_months || 0));

      for (const period of periods) {
        const start = period.month_start || 1;
        const end = period.month_end || durationMonths;
        const months = end - start + 1;
        const factor = period.by_tow?.[tow.tow_id] ?? 1.0;

        weightedFactor += factor * months;
        totalMonths += months;

        periodDetails.push({
          start,
          end,
          factor,
          effectiveQty: Math.round(qty * factor * 100) / 100
        });
      }

      const avgFactor = totalMonths > 0 ? weightedFactor / totalMonths : 1.0;
      if (avgFactor < 1.0) {
        result[tow.tow_id] = {
          avgFactor,
          adjustedQty: Math.round(qty * avgFactor * 100) / 100,
          delta: Math.round(qty * (avgFactor - 1) * 100) / 100,
          periodDetails
        };
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [tows, volumeAdjustments, durationMonths]);

  const hasAdjustments = Object.keys(adjustedQtyMap).length > 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 glass-card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {t('business_plan.tow_config')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('business_plan.tow_config_desc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tows.length > 0 && (
              <div className={`px-2 py-1 rounded-lg text-xs font-semibold
                              ${isWeightValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <Percent className="w-3 h-3 inline mr-1" />
                {totalWeight.toFixed(1)}%
              </div>
            )}
            <button
              onClick={() => setShowAddRow(true)}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                         text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Aggiungi TOW
            </button>
          </div>
        </div>
      </div>

      {/* Tabella */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 w-24">ID</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Descrizione</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 w-36">Tipo</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 w-24">Peso %</th>
              <th className="px-4 py-3 text-center font-semibold text-indigo-600 w-20" title="Quota % del TOW svolta da Lutech (es. in RTI)">Lutech %</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 w-28">Quantità</th>
              {hasAdjustments && (
                <>
                  <th className="px-4 py-3 text-center font-semibold text-emerald-600 w-28 whitespace-nowrap">
                    Quantità Eff.
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-rose-600 w-16">
                    Δ
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-center font-semibold text-slate-600 w-36">Practice</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tows.length === 0 && !showAddRow ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Layers className="w-8 h-8 text-slate-300" />
                    <p>Nessun TOW configurato</p>
                    <button
                      onClick={() => setShowAddRow(true)}
                      disabled={disabled}
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      Aggiungi il primo Type of Work
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              tows.map((tow, idx) => (
                <>
                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={tow.tow_id}
                      onChange={(e) => handleUpdateTow(idx, 'tow_id', e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1 font-mono text-xs border border-transparent
                                 hover:border-slate-200 focus:border-indigo-300 rounded
                                 focus:outline-none disabled:bg-transparent"
                      placeholder="TOW_XX"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={tow.label}
                      onChange={(e) => handleUpdateTow(idx, 'label', e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1 border border-transparent hover:border-slate-200
                                 focus:border-indigo-300 rounded focus:outline-none
                                 disabled:bg-transparent"
                      placeholder="Nome TOW..."
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={tow.type}
                      onChange={(e) => handleUpdateTow(idx, 'type', e.target.value)}
                      disabled={disabled}
                      className={`w-full px-2 py-1 text-xs font-medium rounded border-0
                                  focus:outline-none focus:ring-2 focus:ring-indigo-300
                                  disabled:cursor-not-allowed ${getTypeStyle(tow.type)}`}
                    >
                      {towTypes.map(tt => (
                        <option key={tt.value} value={tt.value}>{tt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={tow.weight_pct}
                      onChange={(e) => handleUpdateTow(idx, 'weight_pct', parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      step="0.1"
                      min="0"
                      max="100"
                      className="w-full px-2 py-1 text-center border border-slate-200 rounded
                                 focus:border-indigo-300 focus:outline-none
                                 disabled:bg-slate-50 disabled:cursor-not-allowed"
                    />
                  </td>
                  {/* Lutech % — editabile per TOW FTE-based, sempre 100% per catalogo */}
                  <td className="px-4 py-2">
                    {tow.type === 'catalogo' ? (
                      <div className="text-center">
                        <span className="text-xs text-slate-400">100%</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={tow.lutech_pct ?? 100}
                        onChange={(e) => handleUpdateTow(idx, 'lutech_pct', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                        disabled={disabled}
                        min="0"
                        max="100"
                        step="5"
                        className={`w-full px-2 py-1 text-center border rounded focus:outline-none text-xs
                          ${(tow.lutech_pct ?? 100) < 100
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 focus:border-indigo-500'
                            : 'border-slate-200 focus:border-indigo-300'}
                          disabled:bg-slate-50 disabled:cursor-not-allowed`}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {tow.type === 'task' ? (
                      <input
                        type="number"
                        value={tow.num_tasks || ''}
                        onChange={(e) => handleUpdateTow(idx, 'num_tasks', parseInt(e.target.value) || 0)}
                        disabled={disabled}
                        min="0"
                        placeholder="N. task"
                        className="w-full px-2 py-1 text-center border border-slate-200 rounded
                                   focus:border-indigo-300 focus:outline-none text-xs
                                   disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    ) : tow.type === 'corpo' || tow.type === 'canone' ? (
                      <input
                        type="number"
                        value={tow.duration_months || ''}
                        onChange={(e) => handleUpdateTow(idx, 'duration_months', parseInt(e.target.value) || 0)}
                        disabled={disabled}
                        min="0"
                        placeholder="N. mesi"
                        className="w-full px-2 py-1 text-center border border-slate-200 rounded
                                   focus:border-indigo-300 focus:outline-none text-xs
                                   disabled:bg-slate-50 disabled:cursor-not-allowed"
                      />
                    ) : tow.type === 'catalogo' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onOpenCatalogModal?.(idx)}
                            disabled={disabled}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600
                                       hover:bg-rose-50 rounded border border-rose-200 transition-colors
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Apri editor catalogo"
                          >
                            <BookOpen className="w-3 h-3" />
                            {(tow.catalog_items || []).length} voci
                          </button>
                          <button
                            onClick={() => toggleCatalogExpand(idx)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          >
                            {expandedCatalog.has(idx) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {(() => {
                          // Modello FTE-from-group: derivedFte = Σ(group_fte × item_pct/100)
                          const items = tow.catalog_items || [];
                          const refFte = parseFloat(tow.total_fte || 0);
                          const totalCatalogValue = parseFloat(tow.total_catalog_value || 0);
                          const groups = tow.catalog_groups || [];
                          const itemGroupMap = {};
                          for (const g of groups) {
                            for (const id of (g.item_ids || [])) itemGroupMap[id] = g;
                          }
                          let derivedFte = 0;
                          for (const item of items) {
                            const group = itemGroupMap[item.id];
                            const group_target = group ? (parseFloat(group.target_value) || 0) : 0;
                            const group_fte = (totalCatalogValue > 0 && group_target > 0)
                              ? (group_target / totalCatalogValue) * refFte
                              : 0;
                            derivedFte += group_fte * (parseFloat(item.group_pct) || 0) / 100;
                          }
                          if (items.length === 0) return null;
                          const ok = refFte > 0 && Math.abs(derivedFte - refFte) / refFte < 0.05;
                          return (
                            <div className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1
                              ${ok ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}
                              title="FTE derivati dal catalogo">
                              {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {derivedFte.toFixed(2)}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="block text-center text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  {hasAdjustments && (() => {
                    const adj = adjustedQtyMap[tow.tow_id];
                    const qty = tow.type === 'task' ? (tow.num_tasks || 0) : (tow.duration_months || 0);
                    const isReduced = adj && adj.avgFactor < 1.0;

                    const tooltip = adj?.periodDetails?.length > 1
                      ? adj.periodDetails.map(p =>
                        `Mese ${p.start}-${p.end}: ${qty} → ${p.effectiveQty} (${Math.round(p.factor * 100)}%)`
                      ).join('\n')
                      : adj?.periodDetails?.[0]
                        ? `${qty} → ${adj.periodDetails[0].effectiveQty} (${Math.round(adj.periodDetails[0].factor * 100)}%)`
                        : '';

                    return (
                      <>
                        <td className="px-4 py-2">
                          <div
                            title={tooltip}
                            className={`px-2 py-1 text-center rounded font-semibold text-xs cursor-help flex items-center justify-center gap-1
                                      ${isReduced ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                          >
                            {isReduced && <TrendingDown className="w-3 h-3" />}
                            {adj ? Math.round(adj.adjustedQty) : qty}
                            {tooltip && <Info className="w-2.5 h-2.5 opacity-50 ml-0.5" />}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {isReduced ? (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                              {adj.delta > 0 ? `+${adj.delta}` : adj.delta}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-4 py-2">
                    <select
                      value={towAssignments[tow.tow_id] || ''}
                      onChange={(e) => handlePracticeAssignment(tow.tow_id, e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded
                                 focus:border-indigo-300 focus:outline-none
                                 disabled:bg-slate-50 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Practice --</option>
                      {practices.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleRemoveTow(idx)}
                      disabled={disabled}
                      className="p-1 text-slate-400 hover:text-red-500 rounded
                                 opacity-0 group-hover:opacity-100 transition-opacity
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                {/* Catalog cluster split sub-row */}
                {tow.type === 'catalogo' && expandedCatalog.has(idx) && (() => {
                  const clusters = tow.catalog_clusters || [];
                  const totalFteInput = parseFloat(tow.total_fte || 0);
                  const durationYears = durationMonths / 12;
                  const colCount = hasAdjustments ? 10 : 8;

                  // Compute cluster split: FTE, avg rate, cost per cluster
                  const clusterRows = clusters.map(cluster => {
                    const requiredPct = parseFloat(cluster.required_pct) || 0;
                    const clusterFte = totalFteInput * requiredPct / 100;
                    const clusterDays = clusterFte * durationYears * daysPerFte;
                    // Average rate of profiles in cluster (equal weight per profile type)
                    const profiles = cluster.poste_profiles || [];
                    let avgRate = defaultDailyRate;
                    if (profiles.length > 0) {
                      const rates = profiles.map(p => computeCatalogItemRate([{ poste_profile: p, pct: 100 }]));
                      avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
                    }
                    const clusterCost = clusterDays * avgRate;
                    return { ...cluster, requiredPct, clusterFte, clusterDays, avgRate, clusterCost };
                  });

                  const totalClusterCost = clusterRows.reduce((s, c) => s + c.clusterCost, 0);

                  return (
                    <tr key={`cat-${idx}`} className="bg-rose-50">
                      <td colSpan={colCount} className="px-6 py-3">
                        {clusters.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            Nessun cluster configurato. Apri l'editor e vai alla tab Cluster.
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500 font-semibold border-b border-rose-200">
                                <th className="text-left pb-1.5">Cluster</th>
                                <th className="text-right pb-1.5 w-20">% Richiesta</th>
                                <th className="text-right pb-1.5 w-20">FTE</th>
                                <th className="text-right pb-1.5 w-20">Gg/uomo</th>
                                <th className="text-right pb-1.5 w-28">Tariffa media</th>
                                <th className="text-right pb-1.5 w-28">Costo cluster</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-rose-100">
                              {clusterRows.map((cr) => (
                                <tr key={cr.id}>
                                  <td className="py-1.5">
                                    <div className="font-medium text-slate-700">{cr.label}</div>
                                    {(cr.poste_profiles || []).length > 0 && (
                                      <div className="text-[10px] text-slate-400">{cr.poste_profiles.join(', ')}</div>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-right font-semibold text-rose-700">{cr.requiredPct.toFixed(0)}%</td>
                                  <td className="py-1.5 text-right tabular-nums text-slate-700">{cr.clusterFte.toFixed(2)}</td>
                                  <td className="py-1.5 text-right tabular-nums text-slate-600">{Math.round(cr.clusterDays)}</td>
                                  <td className="py-1.5 text-right text-slate-600">{formatCurrency(cr.avgRate, 0)}/gg</td>
                                  <td className="py-1.5 text-right font-semibold text-slate-700">{formatCurrency(cr.clusterCost, 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t border-rose-200">
                              <tr className="font-semibold text-slate-700">
                                <td className="pt-1.5">TOTALE</td>
                                <td className="pt-1.5 text-right">100%</td>
                                <td className="pt-1.5 text-right tabular-nums">{totalFteInput.toFixed(2)}</td>
                                <td className="pt-1.5 text-right tabular-nums">{Math.round(totalFteInput * durationYears * 220)}</td>
                                <td></td>
                                <td className="pt-1.5 text-right">{formatCurrency(totalClusterCost, 0)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        )}
                        <button
                          onClick={() => onOpenCatalogModal?.(idx)}
                          disabled={disabled}
                          className="mt-2 text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" /> Modifica voci e cluster →
                        </button>
                      </td>
                    </tr>
                  );
                })()}
                </>
              ))
            )}

            {/* Riga per aggiunta nuovo TOW */}
            {showAddRow && (
              <tr className="bg-indigo-50">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={newTow.tow_id}
                    onChange={(e) => setNewTow({ ...newTow, tow_id: e.target.value.toUpperCase() })}
                    placeholder="TOW_XX"
                    autoFocus
                    className="w-full px-2 py-1 font-mono text-xs border border-indigo-300 rounded
                               focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={newTow.label}
                    onChange={(e) => setNewTow({ ...newTow, label: e.target.value })}
                    placeholder="Nome TOW..."
                    className="w-full px-2 py-1 border border-indigo-300 rounded
                               focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={newTow.type}
                    onChange={(e) => setNewTow({ ...newTow, type: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-indigo-300 rounded
                               focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {towTypes.map(tt => (
                      <option key={tt.value} value={tt.value}>{tt.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={newTow.weight_pct}
                    onChange={(e) => setNewTow({ ...newTow, weight_pct: parseFloat(e.target.value) || 0 })}
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full px-2 py-1 text-center border border-indigo-300 rounded
                               focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={newTow.lutech_pct ?? 100}
                    onChange={(e) => setNewTow({ ...newTow, lutech_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                    min="0"
                    max="100"
                    step="5"
                    className="w-full px-2 py-1 text-center text-xs border border-indigo-300 rounded
                               focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </td>
                <td className="px-4 py-2">
                  {newTow.type === 'task' ? (
                    <input
                      type="number"
                      value={newTow.num_tasks || ''}
                      onChange={(e) => setNewTow({ ...newTow, num_tasks: parseInt(e.target.value) || 0 })}
                      min="0"
                      placeholder="N. task"
                      className="w-full px-2 py-1 text-center text-xs border border-indigo-300 rounded
                                 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : newTow.type === 'corpo' || newTow.type === 'canone' ? (
                    <input
                      type="number"
                      value={newTow.duration_months || ''}
                      onChange={(e) => setNewTow({ ...newTow, duration_months: parseInt(e.target.value) || 0 })}
                      min="0"
                      placeholder="N. mesi"
                      className="w-full px-2 py-1 text-center text-xs border border-indigo-300 rounded
                                 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <span className="block text-center text-slate-400 text-xs">-</span>
                  )}
                </td>
                {hasAdjustments && (
                  <>
                    <td className="px-4 py-2 text-center text-slate-400">-</td>
                    <td className="px-4 py-2 text-center text-slate-400">-</td>
                  </>
                )}
                <td className="px-4 py-2 text-center text-slate-400">-</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={handleAddTow}
                      disabled={!newTow.tow_id.trim() || !newTow.label.trim()}
                      className="p-1 text-green-600 hover:bg-green-100 rounded
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Salva TOW"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowAddRow(false)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                      title="Annulla"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Warning se pesi != 100% */}
      {tows.length > 0 && !isWeightValid && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800">
              <strong>Attenzione:</strong> I pesi TOW sommano a <strong>{totalWeight.toFixed(1)}%</strong> invece di 100%.
              La ripartizione dei ricavi sarà proporzionale ai pesi configurati.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
