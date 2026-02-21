import { useState, useMemo, useCallback } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, BookOpen } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

const TIPO_OPTIONS = [
  { value: 'nuovo_sviluppo', label: 'Nuovo Sviluppo' },
  { value: 'modifica_evolutiva', label: 'Modifica Evolutiva' },
];

const COMPLESSITA_OPTIONS = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

function generateId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Computes the weighted average Lutech daily rate for a given profile_mix.
 * profile_mix: [{ poste_profile, pct }]
 * profileMappings: { poste_profile_id: [{ month_start, month_end, mix: [{lutech_profile, pct}] }] }
 * profileRates: { "practice:profile_id": daily_rate }
 */
function computeItemRate(profileMix, profileMappings, profileRates, defaultRate = 250) {
  if (!profileMix || profileMix.length === 0) return defaultRate;
  let totalWeighted = 0;
  let totalPct = 0;

  for (const entry of profileMix) {
    const pct = (parseFloat(entry.pct) || 0) / 100;
    if (pct <= 0) continue;
    const posteProfile = entry.poste_profile || '';
    const mappings = profileMappings[posteProfile];

    let lutech_rate = defaultRate;
    if (mappings && mappings.length > 0) {
      // Use first period mapping as representative (simplified)
      const firstMapping = mappings[0];
      const mix = firstMapping.mix || [];
      let periodRate = 0;
      for (const mi of mix) {
        const mpct = (parseFloat(mi.pct) || 0) / 100;
        const r = profileRates[mi.lutech_profile] || defaultRate;
        periodRate += mpct * r;
      }
      lutech_rate = periodRate > 0 ? periodRate : defaultRate;
    } else {
      lutech_rate = profileRates[posteProfile] || defaultRate;
    }

    totalWeighted += pct * lutech_rate;
    totalPct += pct;
  }

  return totalPct > 0 ? totalWeighted / totalPct : defaultRate;
}

function ProfileMixEditor({ mix = [], posteProfiles = [], onChange }) {
  const handleChange = (idx, field, value) => {
    const updated = mix.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    onChange(updated);
  };
  const handleAdd = () => onChange([...mix, { poste_profile: '', pct: 0 }]);
  const handleRemove = (idx) => onChange(mix.filter((_, i) => i !== idx));

  const sumPct = mix.reduce((s, e) => s + (parseFloat(e.pct) || 0), 0);
  const isValid = Math.abs(sumPct - 100) < 0.5;

  return (
    <div className="space-y-1">
      {mix.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <select
            value={entry.poste_profile || ''}
            onChange={(e) => handleChange(idx, 'poste_profile', e.target.value)}
            className="flex-1 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
          >
            <option value="">-- Figura --</option>
            {posteProfiles.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="number"
            value={entry.pct}
            onChange={(e) => handleChange(idx, 'pct', parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="5"
            className="w-14 px-1 py-1 text-xs text-center border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
          />
          <span className="text-xs text-slate-400">%</span>
          <button onClick={() => handleRemove(idx)} className="p-0.5 text-slate-400 hover:text-red-500 rounded">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleAdd}
          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Aggiungi figura
        </button>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          Σ {sumPct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function ClusterEditor({ clusters = [], posteProfiles = [], onChange }) {
  const handleChange = (idx, field, value) => {
    const updated = clusters.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    onChange(updated);
  };
  const handleAddProfile = (clusterIdx, profile) => {
    if (!profile) return;
    const c = clusters[clusterIdx];
    if ((c.poste_profiles || []).includes(profile)) return;
    handleChange(clusterIdx, 'poste_profiles', [...(c.poste_profiles || []), profile]);
  };
  const handleRemoveProfile = (clusterIdx, profile) => {
    const c = clusters[clusterIdx];
    handleChange(clusterIdx, 'poste_profiles', (c.poste_profiles || []).filter(p => p !== profile));
  };
  const handleAddCluster = () => {
    onChange([...clusters, { id: `cluster_${Date.now()}`, label: `Cluster ${clusters.length + 1}`, poste_profiles: [], required_pct: 0 }]);
  };
  const handleRemoveCluster = (idx) => onChange(clusters.filter((_, i) => i !== idx));

  const sumPct = clusters.reduce((s, c) => s + (parseFloat(c.required_pct) || 0), 0);
  const isValid = clusters.length === 0 || Math.abs(sumPct - 100) < 0.5;

  return (
    <div className="space-y-3">
      {clusters.map((cluster, idx) => (
        <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cluster.label || ''}
              onChange={(e) => handleChange(idx, 'label', e.target.value)}
              placeholder="Nome cluster..."
              className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={cluster.required_pct || 0}
                onChange={(e) => handleChange(idx, 'required_pct', parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="5"
                className="w-16 px-1.5 py-1 text-sm text-center border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
              />
              <span className="text-xs text-slate-500">%</span>
            </div>
            <button onClick={() => handleRemoveCluster(idx)} className="p-1 text-slate-400 hover:text-red-500 rounded">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(cluster.poste_profiles || []).map(p => (
              <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                {p}
                <button onClick={() => handleRemoveProfile(idx, p)} className="hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <select
              onChange={(e) => { handleAddProfile(idx, e.target.value); e.target.value = ''; }}
              defaultValue=""
              className="px-1.5 py-0.5 text-xs border border-dashed border-slate-300 rounded focus:outline-none"
            >
              <option value="">+ figura...</option>
              {posteProfiles.filter(p => !(cluster.poste_profiles || []).includes(p)).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          onClick={handleAddCluster}
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Aggiungi Cluster
        </button>
        {clusters.length > 0 && (
          <span className={`text-xs font-semibold px-2 py-1 rounded ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            Σ % = {sumPct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * CatalogEditorModal - Modale per configurazione voci catalogo Poste
 *
 * Props:
 *   tow: il TOW tipo 'catalogo' corrente
 *   onChange: (updatedTow) => void
 *   profileMappings: { poste_profile_id: [...] }
 *   profileRates: { "practice:profile": daily_rate }
 *   durationMonths: number
 *   defaultDailyRate: number
 *   onClose: () => void
 */
export default function CatalogEditorModal({
  tow,
  onChange,
  profileMappings = {},
  profileRates = {},
  durationMonths = 36,
  defaultDailyRate = 250,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'clusters'
  const [expandedMix, setExpandedMix] = useState(new Set());

  const items = tow?.catalog_items || [];
  const clusters = tow?.catalog_clusters || [];
  const totalFte = parseFloat(tow?.total_fte || 0);
  const durationYears = durationMonths / 12;

  // Collect all Poste profile IDs used in profile_mappings
  const posteProfiles = useMemo(() => Object.keys(profileMappings), [profileMappings]);

  const toggleMix = (id) => {
    const next = new Set(expandedMix);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedMix(next);
  };

  const updateTow = useCallback((patch) => {
    onChange({ ...tow, ...patch });
  }, [tow, onChange]);

  const handleItemChange = (idx, patch) => {
    const updated = items.map((it, i) => i === idx ? { ...it, ...patch } : it);
    updateTow({ catalog_items: updated });
  };

  const handleAddItem = () => {
    const newItem = {
      id: generateId(),
      label: '',
      tipo: 'nuovo_sviluppo',
      complessita: 'media',
      price_base: 0,
      fte_pct: 0,
      profile_mix: [],
    };
    updateTow({ catalog_items: [...items, newItem] });
  };

  const handleRemoveItem = (idx) => {
    updateTow({ catalog_items: items.filter((_, i) => i !== idx) });
  };

  // Compute per-item derived values
  const itemCalcs = useMemo(() => {
    return items.map(item => {
      const fte_pct = parseFloat(item.fte_pct) || 0;
      const item_fte = totalFte * (fte_pct / 100);
      const item_days = item_fte * durationYears * 220;
      const rate = computeItemRate(item.profile_mix || [], profileMappings, profileRates, defaultDailyRate);
      const cost = item_days * rate;
      const margin = (parseFloat(item.price_base) || 0) - cost;
      return { item_fte, item_days, rate, cost, margin };
    });
  }, [items, totalFte, durationYears, profileMappings, profileRates, defaultDailyRate]);

  // Totals
  const totals = useMemo(() => {
    const totalRevenue = items.reduce((s, it) => s + (parseFloat(it.price_base) || 0), 0);
    const totalCost = itemCalcs.reduce((s, c) => s + c.cost, 0);
    const totalDays = itemCalcs.reduce((s, c) => s + c.item_days, 0);
    const sumFtePct = items.reduce((s, it) => s + (parseFloat(it.fte_pct) || 0), 0);
    const derivedFte = durationYears > 0 ? totalDays / (durationYears * 220) : 0;
    return { totalRevenue, totalCost, totalMargin: totalRevenue - totalCost, totalDays, sumFtePct, derivedFte };
  }, [items, itemCalcs, durationYears]);

  // Cluster distribution
  const clusterDist = useMemo(() => {
    if (clusters.length === 0) return {};
    const profileToCluster = {};
    for (const c of clusters) {
      for (const p of (c.poste_profiles || [])) profileToCluster[p] = c.id;
    }
    const actual = {};
    for (const c of clusters) actual[c.id] = 0;
    for (const item of items) {
      const fte_pct = parseFloat(item.fte_pct) || 0;
      for (const entry of (item.profile_mix || [])) {
        const cid = profileToCluster[entry.poste_profile];
        if (cid !== undefined) actual[cid] = (actual[cid] || 0) + fte_pct * (parseFloat(entry.pct) || 0) / 100;
      }
    }
    return actual;
  }, [clusters, items]);

  const isWeightValid = Math.abs(totals.sumFtePct - 100) < 0.5 || items.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">{tow?.label || 'Catalogo'}</h2>
              <p className="text-xs text-slate-500">
                FTE totali: <strong>{totalFte}</strong> &nbsp;·&nbsp;
                Derivati da voci: <strong>{totals.derivedFte.toFixed(2)}</strong> &nbsp;·&nbsp;
                Durata: <strong>{durationMonths} mesi</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FTE totali input + tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">FTE totali TOW:</label>
            <input
              type="number"
              value={tow?.total_fte ?? ''}
              onChange={(e) => updateTow({ total_fte: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.5"
              className="w-20 px-2 py-1 text-sm text-center border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
            />
            <span className="text-xs text-slate-400">(da capitolato di gara)</span>
          </div>
          <div className="flex gap-1">
            {[
              { key: 'items', label: `Voci (${items.length})` },
              { key: 'clusters', label: `Cluster (${clusters.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                  ${activeTab === tab.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'items' && (
            <div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-48">Descrizione</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-600 w-36">Tipo</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-600 w-28">Complessità</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28">Prezzo Base</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-600 w-20">FTE %</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Mix Figure Poste</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">Tar. €/gg</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">Costo FTE</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-24">Margine</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p>Nessuna voce catalogo. Aggiungi la prima voce.</p>
                      </td>
                    </tr>
                  )}
                  {items.map((item, idx) => {
                    const calc = itemCalcs[idx];
                    const price_base = parseFloat(item.price_base) || 0;
                    const isOk = calc.margin >= 0;
                    const mixExpanded = expandedMix.has(item.id);

                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${!isOk ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.label || ''}
                            onChange={(e) => handleItemChange(idx, { label: e.target.value })}
                            placeholder="Descrizione voce..."
                            className="w-full px-2 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.tipo || 'nuovo_sviluppo'}
                            onChange={(e) => handleItemChange(idx, { tipo: e.target.value })}
                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
                          >
                            {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.complessita || 'media'}
                            onChange={(e) => handleItemChange(idx, { complessita: e.target.value })}
                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
                          >
                            {COMPLESSITA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.price_base || ''}
                            onChange={(e) => handleItemChange(idx, { price_base: parseFloat(e.target.value) || 0 })}
                            min="0"
                            step="1000"
                            placeholder="0"
                            className="w-full px-2 py-1 text-xs text-right border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.fte_pct || ''}
                            onChange={(e) => handleItemChange(idx, { fte_pct: parseFloat(e.target.value) || 0 })}
                            min="0"
                            max="100"
                            step="5"
                            placeholder="0"
                            className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div>
                            <button
                              onClick={() => toggleMix(item.id)}
                              className="w-full text-left text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1 mb-1"
                            >
                              {(item.profile_mix || []).length === 0
                                ? <span className="text-slate-400 italic">Nessuna figura</span>
                                : <span>{(item.profile_mix || []).map(e => `${e.poste_profile} ${e.pct}%`).join(' / ')}</span>
                              }
                              {mixExpanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                            </button>
                            {mixExpanded && (
                              <ProfileMixEditor
                                mix={item.profile_mix || []}
                                posteProfiles={posteProfiles}
                                onChange={(newMix) => handleItemChange(idx, { profile_mix: newMix })}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-600 whitespace-nowrap">
                          {formatCurrency(calc.rate, 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-medium text-slate-700 whitespace-nowrap">
                          {formatCurrency(calc.cost, 0)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className={`flex items-center justify-end gap-1 text-xs font-semibold
                            ${isOk ? 'text-green-700' : 'text-red-700'}`}>
                            {isOk
                              ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : <AlertTriangle className="w-3.5 h-3.5" />
                            }
                            {formatCurrency(calc.margin, 0)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {items.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-slate-700">TOTALE</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {formatCurrency(totals.totalRevenue, 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                          ${isWeightValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {totals.sumFtePct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        Gg totali: {totals.totalDays.toFixed(0)}
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {formatCurrency(totals.totalCost, 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-sm font-bold whitespace-nowrap
                          ${totals.totalMargin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(totals.totalMargin, 0)}
                        </span>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
              <div className="px-4 py-3 border-t border-slate-100">
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi voce
                </button>
              </div>
            </div>
          )}

          {activeTab === 'clusters' && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Vincoli Cluster Poste</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Definisci i cluster di figure professionali richiesti da Poste con le relative percentuali target sul totale FTE del TOW catalogo.
                </p>
                <ClusterEditor
                  clusters={clusters}
                  posteProfiles={posteProfiles}
                  onChange={(newClusters) => updateTow({ catalog_clusters: newClusters })}
                />
              </div>

              {clusters.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribuzione Effettiva</h3>
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">Cluster</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">% Richiesta</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">% Attuale</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Delta</th>
                        <th className="px-4 py-2 text-center font-semibold text-slate-600">Stato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clusters.map(cluster => {
                        const actual = clusterDist[cluster.id] || 0;
                        const required = parseFloat(cluster.required_pct) || 0;
                        const delta = actual - required;
                        const ok = Math.abs(delta) <= 2;
                        return (
                          <tr key={cluster.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <div className="font-medium text-slate-700">{cluster.label}</div>
                              <div className="text-xs text-slate-400">{(cluster.poste_profiles || []).join(', ')}</div>
                            </td>
                            <td className="px-4 py-2 text-right font-medium">{required.toFixed(0)}%</td>
                            <td className="px-4 py-2 text-right">{actual.toFixed(1)}%</td>
                            <td className={`px-4 py-2 text-right font-semibold ${ok ? 'text-green-700' : 'text-red-600'}`}>
                              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                            </td>
                            <td className="px-4 py-2 text-center">
                              {ok
                                ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                                : <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Voci: <strong className="text-slate-700">{items.length}</strong></span>
            <span>FTE Σ: <strong className={isWeightValid ? 'text-green-700' : 'text-red-600'}>{totals.sumFtePct.toFixed(0)}%</strong></span>
            <span>Valore catalogo: <strong className="text-slate-700">{formatCurrency(totals.totalRevenue, 0)}</strong></span>
            <span>Costo FTE: <strong className="text-slate-700">{formatCurrency(totals.totalCost, 0)}</strong></span>
            <span className={`font-semibold ${totals.totalMargin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              Margine: {formatCurrency(totals.totalMargin, 0)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
