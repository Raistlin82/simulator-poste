import { useState, useMemo, useCallback, useRef, Fragment } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp, ChevronRight, AlertTriangle, CheckCircle2, BookOpen, Wand2, Save, Upload } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { bpSaveTrigger } from '../../../utils/bpSaveTrigger';

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

const GROUP_DOTS = ['bg-amber-400', 'bg-cyan-500', 'bg-violet-400', 'bg-emerald-400', 'bg-orange-400', 'bg-pink-400', 'bg-teal-400'];
const GROUP_BADGES = [
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-teal-100 text-teal-800 border-teal-200',
];

/**
 * Computes the weighted average Lutech daily rate for a given profile_mix.
 */
function computeItemRate(profileMix, profileMappings, profileRates, durationMonths = 36, defaultRate = 250) {
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
      let periodWeighted = 0;
      let periodMonthsTotal = 0;
      for (const m of mappings) {
        const ms = parseFloat(m.month_start ?? 1);
        const me = parseFloat(m.month_end ?? durationMonths);
        const months = Math.max(0, me - ms + 1);
        if (months <= 0) continue;
        let pRate = 0;
        for (const mi of (m.mix || [])) {
          const mpct = (parseFloat(mi.pct) || 0) / 100;
          pRate += mpct * (profileRates[mi.lutech_profile] || defaultRate);
        }
        periodWeighted += pRate * months;
        periodMonthsTotal += months;
      }
      lutech_rate = periodMonthsTotal > 0 ? periodWeighted / periodMonthsTotal : defaultRate;
      if (lutech_rate <= 0) lutech_rate = defaultRate;
    } else {
      lutech_rate = profileRates[posteProfile] || defaultRate;
    }

    totalWeighted += pct * lutech_rate;
    totalPct += pct;
  }

  return totalPct > 0 ? totalWeighted / totalPct : defaultRate;
}

function ProfileMixEditor({ mix = [], posteProfiles = [], onChange }) {
  const [search, setSearch] = useState('');

  const handleChangePct = (idx, value) => {
    const updated = mix.map((e, i) => i === idx ? { ...e, pct: parseFloat(value) || 0 } : e);
    onChange(updated);
  };

  const handleAdd = (profile) => {
    if (mix.find(e => e.poste_profile === profile)) return;
    const remaining = Math.max(0, 100 - mix.reduce((s, e) => s + (parseFloat(e.pct) || 0), 0));
    onChange([...mix, { poste_profile: profile, pct: remaining }]);
    setSearch('');
  };

  const handleRemove = (idx) => onChange(mix.filter((_, i) => i !== idx));

  const sumPct = mix.reduce((s, e) => s + (parseFloat(e.pct) || 0), 0);
  const isValid = Math.abs(sumPct - 100) < 0.5;

  const selectedSet = new Set(mix.map(e => e.poste_profile));
  const available = posteProfiles
    .filter(p => !selectedSet.has(p))
    .filter(p => !search || p.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-1.5 pt-1 min-w-[200px]">
      {mix.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 rounded-lg border border-indigo-100">
          <span className="flex-1 text-xs font-medium text-indigo-800 truncate min-w-0">
            {entry.poste_profile || '—'}
          </span>
          <input
            type="number"
            value={entry.pct}
            onChange={(e) => handleChangePct(idx, e.target.value)}
            min="0" max="100" step="5"
            className="w-12 px-1 py-0.5 text-xs text-center border border-indigo-200 bg-white rounded focus:outline-none focus:border-indigo-400 font-semibold text-indigo-700"
          />
          <span className="text-[10px] text-indigo-400">%</span>
          <button onClick={() => handleRemove(idx)} className="p-0.5 text-indigo-300 hover:text-red-500 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-end px-1">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          Σ {sumPct.toFixed(0)}%
        </span>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Aggiungi figura..."
        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
      />
      {available.length > 0 && (
        <div className="max-h-28 overflow-y-auto border border-slate-100 rounded bg-white divide-y divide-slate-50">
          {available.map(p => (
            <button
              key={p}
              onClick={() => handleAdd(p)}
              className="w-full text-left px-2 py-1.5 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors font-medium"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {posteProfiles.length === 0 && (
        <p className="text-[10px] text-slate-400 italic">Nessuna figura nelle mappature profili.</p>
      )}
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
                min="0" max="100" step="5"
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
 * GroupEditor — nuovo modello FTE-from-group.
 * Per ogni raggruppamento: valore target Poste → FTE previsti proporzionali al totale catalogo.
 * Per ogni voce nel raggruppamento: % sul raggruppamento (INPUT, Σ = 100%) → FTE e Pz. Poste proporzionali.
 */
function GroupEditor({ groups, items, totalCatalogValue, totalFte, groupTotals = {}, scontoGaraFactor = 1, onGroupsChange, onToggleGroupItem, onItemPctChange, onEvenDistribute }) {
  const scontoGaraActive = scontoGaraFactor < 0.9999;

  // Collapsed state — tutti collassati per default
  const [collapsedGrps, setCollapsedGrps] = useState(() => new Set(groups.map(g => g.id)));
  const toggleGrp = (id) => setCollapsedGrps(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allExpandedGrps = groups.length > 0 && groups.every(g => !collapsedGrps.has(g.id));
  const toggleAllGrps = () =>
    allExpandedGrps ? setCollapsedGrps(new Set(groups.map(g => g.id))) : setCollapsedGrps(new Set());

  const handleAddGroup = () => {
    onGroupsChange([...groups, {
      id: `group_${Date.now()}`,
      label: `Raggruppamento ${groups.length + 1}`,
      target_value: 0,
      item_ids: [],
    }]);
  };

  const handleChange = (idx, patch) => {
    onGroupsChange(groups.map((g, i) => i === idx ? { ...g, ...patch } : g));
  };

  const handleRemove = (idx) => onGroupsChange(groups.filter((_, i) => i !== idx));

  const sumGroupTargets = groups.reduce((s, g) => s + (parseFloat(g.target_value) || 0), 0);
  const groupTotalOk = totalCatalogValue > 0 && Math.abs(sumGroupTargets - totalCatalogValue) / totalCatalogValue < 0.01;
  const effectiveSumGroupTargets = sumGroupTargets * scontoGaraFactor;
  const effectiveTotalCatalogLocal = totalCatalogValue * scontoGaraFactor;

  return (
    <div className="space-y-4">
      {/* Toolbar expand/collapse all */}
      {groups.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAllGrps}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            {allExpandedGrps
              ? <><ChevronUp className="w-3.5 h-3.5" />Comprimi tutti</>
              : <><ChevronDown className="w-3.5 h-3.5" />Espandi tutti</>
            }
          </button>
          <span className="text-xs text-slate-400">{groups.length} raggruppament{groups.length === 1 ? 'o' : 'i'}</span>
        </div>
      )}

      {/* Validazione somma target vs totale catalogo */}
      {groups.length > 0 && totalCatalogValue > 0 && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
          ${groupTotalOk ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {groupTotalOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          Σ Valori target raggruppamenti: {formatCurrency(scontoGaraActive ? effectiveSumGroupTargets : sumGroupTargets, 0)} / {formatCurrency(scontoGaraActive ? effectiveTotalCatalogLocal : totalCatalogValue, 0)} Totale Catalogo
          {!groupTotalOk && ' — i valori non corrispondono al Totale Catalogo'}
        </div>
      )}

      {groups.map((group, idx) => {
        const dotColor = GROUP_DOTS[idx % GROUP_DOTS.length];
        const badgeColor = GROUP_BADGES[idx % GROUP_BADGES.length];
        const groupTarget = parseFloat(group.target_value) || 0;
        const groupFte = (totalCatalogValue > 0 && groupTarget > 0)
          ? (groupTarget / totalCatalogValue) * totalFte
          : 0;
        const groupItems = items.filter(it => (group.item_ids || []).includes(it.id));
        const sumPct = groupItems.reduce((s, it) => s + (parseFloat(it.group_pct) || 0), 0);
        const isValid = groupItems.length === 0 || Math.abs(sumPct - 100) < 0.5;
        const isCollapsedGrp = collapsedGrps.has(group.id);
        const gt = groupTotals[group.id];

        return (
          <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* ── Header collassabile ── */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 cursor-pointer select-none hover:bg-slate-100 transition-colors"
              onClick={() => toggleGrp(group.id)}
            >
              {isCollapsedGrp
                ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />
              <span className="font-semibold text-sm text-slate-700 flex-1 truncate">{group.label || 'Senza nome'}</span>
              <span className="text-xs text-slate-400">{groupItems.length} {groupItems.length === 1 ? 'voce' : 'voci'}</span>
              {/* Aggregati visibili solo in collapsed */}
              {isCollapsedGrp && (
                <div className="flex items-center gap-3 text-xs ml-2">
                  {totalCatalogValue > 0 && groupFte > 0 && (
                    <span className="text-indigo-600 font-semibold tabular-nums">{groupFte.toFixed(2)} FTE</span>
                  )}
                  <span className={`font-bold px-1.5 py-0.5 rounded ${isValid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    Σ {sumPct.toFixed(0)}%
                  </span>
                  {gt && gt.sell > 0 && (
                    <>
                      <span className="text-slate-600 tabular-nums">Costo: <strong>{formatCurrency(gt.cost, 0)}</strong></span>
                      <span className={`font-semibold tabular-nums ${gt.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        Marg: {gt.marginPct.toFixed(1)}%
                      </span>
                      <span className="text-slate-600 tabular-nums">Vend.: <strong>{formatCurrency(gt.sell, 0)}</strong></span>
                    </>
                  )}
                </div>
              )}
              {/* Stop click propagation on remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
                className="p-1 text-slate-400 hover:text-red-500 rounded ml-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Corpo espanso ── */}
            {!isCollapsedGrp && (
            <div className="p-4 space-y-4">
            {/* Header: nome + valore target (ora senza trash perché già nell'header collassabile) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium shrink-0">Nome:</span>
              <input
                type="text"
                value={group.label || ''}
                onChange={(e) => handleChange(idx, { label: e.target.value })}
                placeholder="Nome raggruppamento..."
                className="flex-1 px-2 py-1 text-sm font-medium border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
              />
            </div>

            {/* Valore target → FTE previsti */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-500 font-medium">Valore target Poste:</label>
              <div className="flex flex-col">
                {scontoGaraActive && groupTarget > 0 ? (
                  <>
                    <div className="text-sm font-semibold text-amber-700 tabular-nums">
                      {formatCurrency(groupTarget * scontoGaraFactor, 0)} €
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number"
                        value={group.target_value || ''}
                        onChange={(e) => handleChange(idx, { target_value: parseFloat(e.target.value) || 0 })}
                        min="0" step="1000" placeholder="0"
                        className="w-28 px-1.5 py-0.5 text-[10px] text-right border border-slate-100 bg-slate-50 text-slate-400 rounded focus:outline-none focus:border-rose-300"
                      />
                      <span className="text-[9px] text-slate-400">bando €</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={group.target_value || ''}
                      onChange={(e) => handleChange(idx, { target_value: parseFloat(e.target.value) || 0 })}
                      min="0" step="1000" placeholder="0"
                      className="w-36 px-2 py-1 text-xs text-right border border-slate-200 rounded focus:outline-none focus:border-rose-300"
                    />
                    <span className="text-xs text-slate-400">€</span>
                  </div>
                )}
              </div>
              {totalCatalogValue > 0 && groupTarget > 0 && (
                <>
                  <span className="text-xs text-slate-400">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded font-semibold text-xs">
                    FTE previsti: {groupFte.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({(groupTarget / totalCatalogValue * 100).toFixed(1)}% del catalogo)
                  </span>
                </>
              )}
              {totalCatalogValue === 0 && (
                <span className="text-xs text-amber-500 italic">Imposta Totale Catalogo € nella testata per vedere gli FTE</span>
              )}
            </div>

            {/* Margine raggruppamento */}
            {groupTotals[group.id] && groupTotals[group.id].sell > 0 && (
              <div className="flex items-center gap-3 flex-wrap px-1">
                <span className="text-xs text-slate-500">
                  Costo Lu.: <strong className="text-slate-700">{formatCurrency(groupTotals[group.id].cost, 0)}</strong>
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">
                  Pz. Vend.: <strong className="text-slate-700">{formatCurrency(groupTotals[group.id].sell, 0)}</strong>
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className={`text-xs font-semibold ${groupTotals[group.id].margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  Marg.: {formatCurrency(groupTotals[group.id].margin, 0)}
                  {' '}({groupTotals[group.id].marginPct.toFixed(1)}%)
                  {groupTotals[group.id].margin >= 0
                    ? <CheckCircle2 className="w-3 h-3 inline ml-1" />
                    : <AlertTriangle className="w-3 h-3 inline ml-1" />}
                </span>
              </div>
            )}

            {/* Distribuzione % per voce */}
            {groupItems.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Distribuzione voci nel raggruppamento
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isValid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      Σ {sumPct.toFixed(0)}% {isValid ? '✓' : '≠ 100%'}
                    </span>
                    <button
                      onClick={() => onEvenDistribute(group.id)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
                    >
                      <Wand2 className="w-3 h-3" />
                      Distribuisci uniformemente
                    </button>
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                      <th className="text-left pb-1.5">Voce</th>
                      <th className="text-right pb-1.5 w-28">% Raggruppamento</th>
                      <th className="text-right pb-1.5 w-20">FTE</th>
                      <th className="text-right pb-1.5 w-28">Pz. Poste Tot.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupItems.map(it => {
                      const pct = parseFloat(it.group_pct) || 0;
                      const fte = groupFte * pct / 100;
                      const posteTot = groupTarget * pct / 100;
                      return (
                        <tr key={it.id}>
                          <td className="py-1.5 pr-2 text-xs text-slate-700 truncate max-w-[180px]">
                            {it.label || <em className="text-slate-400">Senza nome</em>}
                          </td>
                          <td className="py-1.5 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <input
                                type="number"
                                value={pct || ''}
                                onChange={(e) => onItemPctChange(it.id, parseFloat(e.target.value) || 0)}
                                min="0" max="100" step="1" placeholder="0"
                                className="w-16 px-1.5 py-0.5 text-xs text-right border border-slate-200 bg-white rounded focus:outline-none focus:border-indigo-300 font-medium"
                              />
                              <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                            </div>
                          </td>
                          <td className="py-1.5 text-right text-xs text-indigo-700 font-semibold tabular-nums">
                            {totalCatalogValue > 0 ? fte.toFixed(2) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {totalCatalogValue > 0
                              ? <div>
                                  <div className="text-xs text-slate-600">{formatCurrency(posteTot * scontoGaraFactor, 0)}</div>
                                  {scontoGaraActive && (
                                    <div className="text-[10px] text-slate-400">bando: {formatCurrency(posteTot, 0)}</div>
                                  )}
                                </div>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Toggle voci (aggiungi/rimuovi dal raggruppamento) */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5 font-medium">
                Voci incluse — clic per aggiungere/rimuovere:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.length === 0 && (
                  <span className="text-xs text-slate-400 italic">Nessuna voce disponibile. Aggiungine nel tab "Voci".</span>
                )}
                {items.map(it => {
                  const included = (group.item_ids || []).includes(it.id);
                  return (
                    <button
                      key={it.id}
                      onClick={() => onToggleGroupItem(group.id, it.id)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition-colors
                        ${included
                          ? `${badgeColor} font-medium`
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {it.label || <em>Senza nome</em>}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>
            )}
          </div>
        );
      })}

      <button
        onClick={handleAddGroup}
        className="flex items-center gap-1.5 text-sm text-rose-600 hover:text-rose-800 font-medium"
      >
        <Plus className="w-4 h-4" /> Aggiungi Raggruppamento
      </button>
    </div>
  );
}

/**
 * CatalogEditorModal — modello FTE-from-group.
 *
 * Gerarchia:
 *   TOW (total_fte, total_catalog_value, target_margin_pct)
 *     └─ Raggruppamento (target_value → group_fte = target_value/total_catalog × total_fte)
 *          └─ Voce (group_pct → item_fte = group_fte × pct/100)
 *               item_cost = item_fte × rate × anni × daysPerFte
 *               item_sell_price = item_cost / (1 - margine_target/100)
 *               item_poste_total = group_target × pct/100
 *               item_lutech_unit = (sell_price / poste_total) × price_base
 *               item_sconto_pct = (1 - lutech_unit / price_base) × 100
 */
export default function CatalogEditorModal({
  tow,
  onChange,
  profileMappings = {},
  profileRates = {},
  durationMonths = 36,
  daysPerFte = 220,
  defaultDailyRate = 250,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('items');
  const [expandedMix, setExpandedMix] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set()); // default: tutti collassati
  const [importFeedback, setImportFeedback] = useState(null); // { imported, skipped, errors }
  const csvInputRef = useRef(null);

  const items = tow?.catalog_items || [];
  const clusters = tow?.catalog_clusters || [];
  const catalogGroups = tow?.catalog_groups || [];
  const durationYears = durationMonths / 12;

  const refTotalFte = parseFloat(tow?.total_fte ?? 0);
  const totalCatalogValue = parseFloat(tow?.total_catalog_value ?? 0);
  const defaultTargetMarginPct = parseFloat(tow?.target_margin_pct ?? 20);

  // Sconto gara/lotto: riduce proporzionalmente tutti i valori Poste
  const scontoGaraPct = parseFloat(tow?.sconto_gara_pct ?? 0);
  const scontoGaraFactor = 1 - scontoGaraPct / 100;
  const effectiveTotalCatalog = totalCatalogValue * scontoGaraFactor;

  const posteProfiles = useMemo(() => Object.keys(profileMappings), [profileMappings]);

  // Map item.id → { group, colorIdx }
  const itemToGroup = useMemo(() => {
    const map = {};
    catalogGroups.forEach((g, idx) => {
      (g.item_ids || []).forEach(id => { map[id] = { group: g, colorIdx: idx }; });
    });
    return map;
  }, [catalogGroups]);

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
      target_margin_pct: null,  // null = usa margine target TOW
      group_pct: 0,             // % nel raggruppamento (INPUT)
      profile_mix: [],
    };
    updateTow({ catalog_items: [...items, newItem] });
  };

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    const TIPO_MAP = { n: 'nuovo_sviluppo', m: 'modifica_evolutiva' };
    const COMPL_MAP = { l: 'bassa', m: 'media', h: 'alta' };

    const parseCsvLine = (line) => {
      const cols = [];
      let cur = '';
      let inQuote = false;
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      return cols.map(c => c.replace(/^"|"$/g, '').trim());
    };

    const reader = new FileReader();
    reader.onload = (ev) => {
      // Strip BOM if present
      const raw = ev.target.result.replace(/^\uFEFF/, '');
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setImportFeedback({ imported: 0, updated: 0, skipped: 0, errors: ['File vuoto o senza righe dati'] });
        return;
      }

      const dataLines = lines.slice(1);
      // Mutable copy of existing items for upsert
      const resultItems = items.map(it => ({ ...it }));
      const errorRows = [];
      let importedCount = 0;
      let updatedCount = 0;

      dataLines.forEach((line, idx) => {
        const cols = parseCsvLine(line);
        // DescrizioneVoce,Tipo,Complessita,PrezzoUnitario,Ruolo1..10,Perc1..10
        const [
          rawLabel = '', rawTipo = '', rawCompl = '', rawPrice = '',
          r1 = '', r2 = '', r3 = '', r4 = '', r5 = '', r6 = '', r7 = '', r8 = '', r9 = '', r10 = '',
          p1 = '', p2 = '', p3 = '', p4 = '', p5 = '', p6 = '', p7 = '', p8 = '', p9 = '', p10 = '',
        ] = cols;

        const label = rawLabel.trim();
        const tipo = TIPO_MAP[rawTipo.trim().toLowerCase()];
        const complessita = COMPL_MAP[rawCompl.trim().toLowerCase()];
        const price = parseFloat(rawPrice.replace(',', '.'));
        const rowNum = idx + 2;

        if (!label) { errorRows.push(`Riga ${rowNum}: descrizione vuota`); return; }
        if (!tipo) { errorRows.push(`Riga ${rowNum}: Tipo non valido ('${rawTipo}') — usa N o M`); return; }
        if (!complessita) { errorRows.push(`Riga ${rowNum}: Complessità non valida ('${rawCompl}') — usa L, M o H`); return; }
        if (isNaN(price) || price < 0) { errorRows.push(`Riga ${rowNum}: PrezzoUnitario non valido ('${rawPrice}')`); return; }

        // Build profile_mix from Ruolo/Perc pairs (skip empty ruoli)
        const ruoli = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10];
        const percs = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];
        const profile_mix = [];
        for (let i = 0; i < 10; i++) {
          const ruolo = ruoli[i].trim();
          if (!ruolo) continue;
          const pct = parseFloat(percs[i]);
          if (isNaN(pct) || pct <= 0) {
            errorRows.push(`Riga ${rowNum}: Perc${i + 1} non valida per Ruolo${i + 1} '${ruolo}'`);
            continue;
          }
          profile_mix.push({ poste_profile: ruolo, pct });
        }

        // Upsert: cerca corrispondenza case-insensitive per label
        const existingIdx = resultItems.findIndex(
          it => it.label.trim().toLowerCase() === label.toLowerCase()
        );

        if (existingIdx >= 0) {
          // Update existing item
          resultItems[existingIdx] = {
            ...resultItems[existingIdx],
            tipo,
            complessita,
            price_base: Math.round(price * 100) / 100,
            ...(profile_mix.length > 0 ? { profile_mix } : {}),
          };
          updatedCount++;
        } else {
          // Insert new item
          resultItems.push({
            id: generateId(),
            label,
            tipo,
            complessita,
            price_base: Math.round(price * 100) / 100,
            target_margin_pct: null,
            group_pct: 0,
            profile_mix,
          });
          importedCount++;
        }
      });

      updateTow({ catalog_items: resultItems });
      setImportFeedback({ imported: importedCount, updated: updatedCount, skipped: errorRows.length, errors: errorRows });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleRemoveItem = (idx) => {
    const removedId = items[idx].id;
    const newItems = items.filter((_, i) => i !== idx);
    // Rimuovi anche dai raggruppamenti
    const newGroups = catalogGroups.map(g => ({
      ...g,
      item_ids: (g.item_ids || []).filter(id => id !== removedId),
    }));
    updateTow({ catalog_items: newItems, catalog_groups: newGroups });
  };

  // Toggle voce in raggruppamento + redistribuisce % uniformemente
  const handleToggleGroupItem = useCallback((groupId, itemId) => {
    const group = catalogGroups.find(g => g.id === groupId);
    if (!group) return;

    const currentIds = group.item_ids || [];
    const isRemoving = currentIds.includes(itemId);
    const newIds = isRemoving
      ? currentIds.filter(id => id !== itemId)
      : [...currentIds, itemId];

    // Rimuovi la voce da altri raggruppamenti (ogni voce sta in un solo gruppo)
    const newGroups = catalogGroups.map(g => {
      if (g.id === groupId) return { ...g, item_ids: newIds };
      if (!isRemoving) return { ...g, item_ids: (g.item_ids || []).filter(id => id !== itemId) };
      return g;
    });

    // Redistribuisci % uniformemente tra le voci ora nel raggruppamento
    const n = newIds.length;
    const evenPct = n > 0 ? 100 / n : 0;
    const newItems = items.map(it => {
      if (newIds.includes(it.id)) return { ...it, group_pct: evenPct };
      if (isRemoving && it.id === itemId) return { ...it, group_pct: 0 };
      return it;
    });

    updateTow({ catalog_groups: newGroups, catalog_items: newItems });
  }, [catalogGroups, items, updateTow]);

  const handleItemPctChange = useCallback((itemId, newPct) => {
    const updated = items.map(it =>
      it.id === itemId ? { ...it, group_pct: Math.max(0, Math.min(100, newPct)) } : it
    );
    updateTow({ catalog_items: updated });
  }, [items, updateTow]);

  // Distribuisce % uniformemente tra tutte le voci di un raggruppamento
  const handleEvenDistribute = useCallback((groupId) => {
    const group = catalogGroups.find(g => g.id === groupId);
    if (!group || !group.item_ids || group.item_ids.length === 0) return;
    const n = group.item_ids.length;
    const pct = 100 / n;
    const updated = items.map(it =>
      (group.item_ids || []).includes(it.id) ? { ...it, group_pct: pct } : it
    );
    updateTow({ catalog_items: updated });
  }, [catalogGroups, items, updateTow]);

  // Modifica dello Sconto% → ricalcola target_margin_pct (inverso)
  // item_sell_target = item_poste_total × (1 − sconto/100)
  // newMargin = (1 − item_cost / item_sell_target) × 100
  const handleItemScontoChange = (idx, newSconto) => {
    const calc = itemCalcs[idx];
    if (!calc.has_valid_data || calc.item_poste_total <= 0) return;
    const item_sell_target = calc.item_poste_total * (1 - newSconto / 100);
    let newMargin;
    if (item_sell_target > 0.01 && calc.item_cost > 0) {
      newMargin = (1 - calc.item_cost / item_sell_target) * 100;
    } else if (calc.item_cost <= 0) {
      newMargin = 100;
    } else {
      newMargin = -999;
    }
    handleItemChange(idx, { target_margin_pct: Math.max(-999, Math.min(99.9, newMargin)) });
  };

  // Calcoli per voce — modello FTE-from-group:
  //   group_fte = (group.target_value / total_catalog_value) × total_fte
  //   item_fte  = group_fte × item.group_pct / 100
  //   item_cost = item_fte × rate × anni × daysPerFte
  //   item_sell = item_cost / (1 − margine_target/100)      [Prezzo Vendita Tot.]
  //   item_poste = group.target_value × item.group_pct / 100 [Prezzo Poste Tot.]
  //   item_lutech_unit = (item_sell / item_poste) × price_base
  //   item_sconto_pct  = (1 − item_lutech_unit / price_base) × 100
  const itemCalcs = useMemo(() => {
    return items.map(item => {
      const groupInfo = itemToGroup[item.id];
      const group = groupInfo?.group;
      const group_target = group ? (parseFloat(group.target_value) || 0) : 0;
      const group_fte = (totalCatalogValue > 0 && group_target > 0)
        ? (group_target / totalCatalogValue) * refTotalFte
        : 0;
      const item_pct = parseFloat(item.group_pct) || 0;
      const item_fte = group_fte * item_pct / 100;

      const rate = computeItemRate(
        item.profile_mix || [], profileMappings, profileRates, durationMonths, defaultDailyRate
      );

      // Costo Tot. = FTE × tariffa × anni × giorni/FTE
      const item_cost = item_fte * rate * durationYears * daysPerFte;

      const is_default_margin = item.target_margin_pct === null || item.target_margin_pct === undefined;
      const effective_margin = is_default_margin
        ? defaultTargetMarginPct
        : parseFloat(item.target_margin_pct);

      // Prezzo Vendita Tot. = Costo / (1 − margine_target/100)
      const margin_factor = 1 - effective_margin / 100;
      const item_sell_price = margin_factor > 0.001 ? item_cost / margin_factor : item_cost;

      const price_base_orig = parseFloat(item.price_base) || 0;

      // Applica sconto gara/lotto ai valori Poste (proporzionale)
      const effective_group_target = group_target * scontoGaraFactor;
      const effective_price_base = price_base_orig * scontoGaraFactor;

      // Pz. Poste Tot. = effective_group_target × item_pct / 100
      const item_poste_total_orig = group_target * item_pct / 100;
      const item_poste_total = effective_group_target * item_pct / 100;

      // Pz. Unitario Lutech = (item_sell / item_poste) × effective_price_base
      // Nota: i fattori si cancellano → lutech_unit_abs invariato rispetto all'originale
      const item_lutech_unit = (item_poste_total > 0 && effective_price_base > 0)
        ? (item_sell_price / item_poste_total) * effective_price_base
        : 0;

      // Sconto % = (1 − lutech_unit / effective_price_base) × 100
      const item_sconto_pct = (effective_price_base > 0 && item_lutech_unit > 0)
        ? (1 - item_lutech_unit / effective_price_base) * 100
        : 0;

      const has_valid_data = !!group && totalCatalogValue > 0 && group_target > 0;

      return {
        rate, item_fte, item_cost,
        effective_margin, is_default_margin,
        item_sell_price,
        item_poste_total,         // effettivo (post sconto gara)
        item_poste_total_orig,    // originale da bando
        effective_price_base,     // Pz. Unit. Poste effettivo
        price_base_orig,          // Pz. Unit. Poste originale
        item_lutech_unit, item_sconto_pct,
        group_fte, group_target, effective_group_target, item_pct,
        in_group: !!group,
        has_valid_data,
      };
    });
  }, [items, itemToGroup, totalCatalogValue, refTotalFte, profileMappings, profileRates, defaultDailyRate, durationMonths, durationYears, defaultTargetMarginPct, scontoGaraFactor, daysPerFte]);

  const totals = useMemo(() => {
    const totalDerivedFte = itemCalcs.reduce((s, c) => s + c.item_fte, 0);
    const totalCost = itemCalcs.reduce((s, c) => s + c.item_cost, 0);
    const totalSellPrice = itemCalcs.reduce((s, c) => s + c.item_sell_price, 0);
    const totalPosteTotal = itemCalcs.reduce((s, c) => s + c.item_poste_total, 0);
    const totalMarginEur = totalSellPrice - totalCost;
    const totalMarginPct = totalSellPrice > 0 ? totalMarginEur / totalSellPrice * 100 : 0;
    return { totalDerivedFte, totalCost, totalSellPrice, totalPosteTotal, totalMarginEur, totalMarginPct };
  }, [itemCalcs]);

  // Margine per raggruppamento (aggregazione da itemCalcs)
  const groupTotals = useMemo(() => {
    const map = {};
    catalogGroups.forEach(g => {
      let cost = 0, sell = 0;
      items.forEach((it, i) => {
        if ((g.item_ids || []).includes(it.id)) {
          cost += itemCalcs[i].item_cost;
          sell += itemCalcs[i].item_sell_price;
        }
      });
      const margin = sell - cost;
      const marginPct = sell > 0 ? margin / sell * 100 : 0;
      map[g.id] = { cost, sell, margin, marginPct };
    });
    return map;
  }, [catalogGroups, items, itemCalcs]);

  // Raggruppa gli item per gruppo (usato per collapse nel tab Voci)
  const groupedItems = useMemo(() => {
    const groupMap = new Map(); // groupId → { group, colorIdx, indices }
    const ungrouped = [];
    items.forEach((item, idx) => {
      const info = itemToGroup[item.id];
      if (info) {
        if (!groupMap.has(info.group.id)) {
          groupMap.set(info.group.id, { group: info.group, colorIdx: info.colorIdx, indices: [] });
        }
        groupMap.get(info.group.id).indices.push(idx);
      } else {
        ungrouped.push(idx);
      }
    });
    const result = Array.from(groupMap.values());
    if (ungrouped.length > 0) result.push({ group: null, colorIdx: -1, indices: ungrouped });
    return result;
  }, [items, itemToGroup]);

  const toggleExpandedGroup = useCallback((groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const allGroupIds = useMemo(() => catalogGroups.map(g => g.id), [catalogGroups]);
  const allExpanded = allGroupIds.length > 0 && allGroupIds.every(id => expandedGroups.has(id));

  const toggleAllGroups = useCallback(() => {
    if (allExpanded) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(allGroupIds));
    }
  }, [allExpanded, allGroupIds]);

  // Distribuzione cluster pesata sugli FTE
  const clusterDist = useMemo(() => {
    if (clusters.length === 0) return {};
    const profileToCluster = {};
    for (const c of clusters) {
      for (const p of (c.poste_profiles || [])) profileToCluster[p] = c.id;
    }
    const actual = {};
    for (const c of clusters) actual[c.id] = 0;

    const totalFteLocal = totals.totalDerivedFte;
    if (totalFteLocal > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const weight = itemCalcs[i].item_fte / totalFteLocal;
        for (const entry of (item.profile_mix || [])) {
          const cid = profileToCluster[entry.poste_profile];
          if (cid !== undefined) {
            actual[cid] = (actual[cid] || 0) + weight * (parseFloat(entry.pct) || 0);
          }
        }
      }
    }
    return actual;
  }, [clusters, items, itemCalcs, totals.totalDerivedFte]);

  // Quadratura FTE
  const fteDiff = totals.totalDerivedFte - refTotalFte;
  const fteOk = refTotalFte === 0 || Math.abs(fteDiff / refTotalFte) < 0.05;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[99vw] max-h-[94vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-800 truncate">{tow?.label || 'Catalogo'}</h2>
              <div className="flex items-center gap-3 flex-wrap mt-1">

                {/* Margine Target */}
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  Margine Target:
                  <input
                    type="number"
                    value={tow?.target_margin_pct ?? 20}
                    onChange={(e) => updateTow({ target_margin_pct: parseFloat(e.target.value) || 0 })}
                    min="0" max="99" step="1"
                    className="w-12 px-1.5 py-0.5 text-xs text-center border border-emerald-300 bg-emerald-50 text-emerald-700 rounded focus:outline-none focus:border-emerald-400 font-semibold"
                  />
                  <span className="text-slate-400">%</span>
                </label>

                <span className="text-xs text-slate-300">|</span>

                {/* Sconto Gara/Lotto */}
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  Sconto Gara/Lotto:
                  <input
                    type="number"
                    value={tow?.sconto_gara_pct ?? 0}
                    onChange={(e) => updateTow({ sconto_gara_pct: parseFloat(e.target.value) || 0 })}
                    min="0" max="100" step="0.01"
                    className={`w-16 px-1.5 py-0.5 text-xs text-center border rounded focus:outline-none font-semibold
                      ${scontoGaraPct > 0
                        ? 'border-amber-400 bg-amber-50 text-amber-700 focus:border-amber-500'
                        : 'border-slate-300 bg-white text-slate-600 focus:border-slate-400'}`}
                  />
                  <span className="text-slate-400">%</span>
                </label>

                <span className="text-xs text-slate-300">|</span>

                {/* Totale Catalogo € — flip se sconto gara > 0 */}
                <div className="flex flex-col">
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    Totale Catalogo:
                    {scontoGaraPct > 0 && totalCatalogValue > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-amber-700 tabular-nums">{formatCurrency(effectiveTotalCatalog, 0)} €</span>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            value={tow?.total_catalog_value ?? ''}
                            onChange={(e) => updateTow({ total_catalog_value: parseFloat(e.target.value) || 0 })}
                            min="0" step="1000" placeholder="0"
                            className="w-24 px-1.5 py-0.5 text-[10px] text-right border border-slate-100 bg-slate-50 text-slate-400 rounded focus:outline-none focus:border-rose-300"
                          />
                          <span className="text-[9px] text-slate-400">bando €</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <input
                          type="number"
                          value={tow?.total_catalog_value ?? ''}
                          onChange={(e) => updateTow({ total_catalog_value: parseFloat(e.target.value) || 0 })}
                          min="0" step="1000" placeholder="0"
                          className="w-28 px-1.5 py-0.5 text-xs text-right border border-rose-300 bg-rose-50 text-rose-700 rounded focus:outline-none focus:border-rose-400 font-semibold"
                        />
                        <span className="text-slate-400">€</span>
                      </>
                    )}
                  </label>
                </div>

                <span className="text-xs text-slate-300">|</span>

                {/* FTE Contratto — editabile */}
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  FTE contratto:
                  <input
                    type="number"
                    value={tow?.total_fte ?? ''}
                    onChange={(e) => updateTow({ total_fte: parseFloat(e.target.value) || 0 })}
                    min="0" step="0.5" placeholder="0.00"
                    className="w-16 px-1.5 py-0.5 text-xs text-center border border-indigo-300 bg-indigo-50 text-indigo-700 rounded focus:outline-none focus:border-indigo-400 font-semibold"
                  />
                </label>

                {/* FTE quadratura badge */}
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[11px]
                  ${fteOk ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  FTE derivati: {totals.totalDerivedFte.toFixed(2)}
                  {refTotalFte > 0 && !fteOk && ` (Δ${fteDiff > 0 ? '+' : ''}${fteDiff.toFixed(2)})`}
                </span>

                <span className="text-xs text-slate-500">Voci: <strong className="text-slate-700">{items.length}</strong></span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-2 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center justify-start px-6 py-2 border-b border-slate-100 bg-white gap-1">
          {[
            { key: 'items', label: `Voci (${items.length})` },
            { key: 'groups', label: `Raggruppamenti (${catalogGroups.length})` },
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

        {/* ── Content ── */}
        <div className="flex-1 overflow-auto">

          {/* ── Tab: Voci ── */}
          {activeTab === 'items' && (
            <div>
              {/* Toolbar gruppi */}
              {catalogGroups.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/60">
                  <button
                    onClick={toggleAllGroups}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {allExpanded
                      ? <><ChevronUp className="w-3.5 h-3.5" />Comprimi tutti</>
                      : <><ChevronDown className="w-3.5 h-3.5" />Espandi tutti</>
                    }
                  </button>
                  <span className="text-xs text-slate-400">{catalogGroups.length} raggruppament{catalogGroups.length === 1 ? 'o' : 'i'}</span>
                </div>
              )}
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 w-44">Descrizione</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-600 w-28">Tipo / Compl.</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28" title="Prezzo unitario offerta economica Poste">Pz. Unit. Poste</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Mix Figure Poste / €/gg</th>
                    <th className="px-3 py-2 text-center font-semibold text-rose-600 w-20" title="% della voce sul raggruppamento (INPUT). Σ% per raggruppamento = 100%">% Grp</th>
                    <th className="px-3 py-2 text-right font-semibold text-indigo-600 w-20" title="FTE = FTE raggruppamento × % voce / 100">FTE</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28" title="Costo Tot. = FTE × €/gg × anni × gg/FTE">Costo Tot.</th>
                    <th className="px-3 py-2 text-center font-semibold text-emerald-600 w-20" title="Margine Target per la voce (vuoto = usa margine target TOW)">Marg.%</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28" title="Pz. Vendita Tot. = Costo / (1 − Marg.%)">Pz. Vend. Tot.</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500 w-28" title="Prezzo Poste totale = % voce × valore target raggruppamento">Pz. Poste Tot.</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 w-28" title="Pz. Unit. Lutech = (Pz.Vend.Tot / Pz.Poste.Tot) × Pz.Unit.Poste">Pz. Unit. Lu.</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500 w-20" title="Sconto % = (1 − Pz.Unit.Lu / Pz.Unit.Poste) × 100">Sconto %</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p>Nessuna voce catalogo. Aggiungi la prima voce.</p>
                      </td>
                    </tr>
                  )}
                  {groupedItems.map(({ group, colorIdx, indices }) => {
                    const gId = group?.id ?? '__ungrouped__';
                    const isCollapsed = group && !expandedGroups.has(gId);
                    const groupCalc = indices.reduce((acc, i) => ({
                      fte:    acc.fte    + (itemCalcs[i]?.item_fte        || 0),
                      cost:   acc.cost   + (itemCalcs[i]?.item_cost       || 0),
                      sell:   acc.sell   + (itemCalcs[i]?.item_sell_price || 0),
                      poste:  acc.poste  + (itemCalcs[i]?.item_poste_total|| 0),
                      pctSum: acc.pctSum + (parseFloat(items[i]?.group_pct) || 0),
                    }), { fte: 0, cost: 0, sell: 0, poste: 0, pctSum: 0 });
                    const groupMarginPct = groupCalc.sell > 0
                      ? (groupCalc.sell - groupCalc.cost) / groupCalc.sell * 100
                      : 0;
                    const pctSumOk = groupCalc.pctSum > 0 && Math.abs(groupCalc.pctSum - 100) < 0.5;
                    return (
                      <Fragment key={gId}>
                        {/* Group header row — colonne allineate */}
                        {group && (
                          <tr
                            className="bg-slate-100/70 hover:bg-slate-100 cursor-pointer select-none"
                            onClick={() => toggleExpandedGroup(gId)}
                          >
                            {/* 1: Descrizione */}
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1.5 text-xs">
                                {isCollapsed
                                  ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                }
                                <span className={`w-2 h-2 rounded-full shrink-0 ${GROUP_DOTS[colorIdx % GROUP_DOTS.length]}`} />
                                <span className="font-semibold text-slate-700 truncate">{group.label}</span>
                                <span className="text-slate-400 text-[10px] shrink-0">({indices.length} {indices.length === 1 ? 'voce' : 'voci'})</span>
                              </div>
                            </td>
                            {/* 2: Tipo/Compl */}<td />
                            {/* 3: Pz.Unit.Poste */}<td />
                            {/* 4: Mix Figure */}<td />
                            {/* 5: % Grp */}
                            <td className="px-3 py-1.5 text-center">
                              {isCollapsed && groupCalc.pctSum > 0 && (
                                <span className={`text-xs font-bold tabular-nums ${pctSumOk ? 'text-green-600' : 'text-amber-600'}`}>
                                  {groupCalc.pctSum.toFixed(0)}%
                                </span>
                              )}
                            </td>
                            {/* 6: FTE */}
                            <td className="px-3 py-1.5 text-right">
                              {isCollapsed && (
                                <span className="text-xs font-semibold text-indigo-600 tabular-nums">{groupCalc.fte.toFixed(2)}</span>
                              )}
                            </td>
                            {/* 7: Costo Tot */}
                            <td className="px-3 py-1.5 text-right">
                              {isCollapsed && (
                                <span className="text-xs font-semibold text-slate-600 tabular-nums">{formatCurrency(groupCalc.cost, 0)}</span>
                              )}
                            </td>
                            {/* 8: Marg.% */}
                            <td className="px-3 py-1.5 text-center">
                              {isCollapsed && groupCalc.sell > 0 && (
                                <span className={`text-xs font-bold tabular-nums ${groupMarginPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {groupMarginPct.toFixed(1)}%
                                </span>
                              )}
                            </td>
                            {/* 9: Pz. Vend. Tot */}
                            <td className="px-3 py-1.5 text-right">
                              {isCollapsed && groupCalc.sell > 0 && (
                                <span className="text-xs font-semibold text-slate-600 tabular-nums">{formatCurrency(groupCalc.sell, 0)}</span>
                              )}
                            </td>
                            {/* 10: Pz. Poste Tot */}
                            <td className="px-3 py-1.5 text-right">
                              {isCollapsed && groupCalc.poste > 0 && (
                                <span className="text-xs text-slate-500 tabular-nums">{formatCurrency(groupCalc.poste, 0)}</span>
                              )}
                            </td>
                            {/* 11: Pz. Unit. Lu */}<td />
                            {/* 12: Sconto % */}<td />
                            {/* 13: azioni */}<td />
                          </tr>
                        )}
                        {!isCollapsed && indices.map((idx) => {
                    const item = items[idx];
                    const calc = itemCalcs[idx];
                    const mixExpanded = expandedMix.has(item.id);
                    const groupInfo = itemToGroup[item.id];

                    // Cella N/D se voce non ha dati validi
                    const NA = <span className="text-slate-300 tabular-nums">—</span>;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors align-top">

                        {/* Descrizione + badge raggruppamento */}
                        <td className="px-3 py-3">
                          {groupInfo && (
                            <div className="mb-0.5">
                              <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1 py-0 rounded border
                                ${GROUP_BADGES[groupInfo.colorIdx % GROUP_BADGES.length]}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${GROUP_DOTS[groupInfo.colorIdx % GROUP_DOTS.length]}`} />
                                {groupInfo.group.label}
                              </span>
                            </div>
                          )}
                          <input
                            type="text"
                            value={item.label || ''}
                            onChange={(e) => handleItemChange(idx, { label: e.target.value })}
                            placeholder="Descrizione voce..."
                            className="w-full px-2 py-1 text-xs border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded focus:outline-none"
                          />
                        </td>

                        {/* Tipo + Complessità (merged) */}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <select
                              value={item.tipo || 'nuovo_sviluppo'}
                              onChange={(e) => handleItemChange(idx, { tipo: e.target.value })}
                              className={`w-full px-1.5 py-0.5 text-[10px] font-semibold rounded-full border-0 focus:outline-none focus:ring-1 cursor-pointer
                                ${item.tipo === 'modifica_evolutiva'
                                  ? 'bg-emerald-100 text-emerald-700 focus:ring-emerald-300'
                                  : 'bg-blue-100 text-blue-700 focus:ring-blue-300'}`}
                            >
                              {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <select
                              value={item.complessita || 'media'}
                              onChange={(e) => handleItemChange(idx, { complessita: e.target.value })}
                              className={`w-full px-1.5 py-0.5 text-[10px] font-semibold rounded-full border-0 focus:outline-none focus:ring-1 cursor-pointer
                                ${item.complessita === 'alta'
                                  ? 'bg-red-100 text-red-700 focus:ring-red-300'
                                  : item.complessita === 'bassa'
                                    ? 'bg-green-100 text-green-700 focus:ring-green-300'
                                    : 'bg-amber-100 text-amber-700 focus:ring-amber-300'}`}
                            >
                              {COMPLESSITA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                        </td>

                        {/* Pz. Unit. Poste — flip se sconto gara > 0 */}
                        <td className="px-3 py-3">
                          {scontoGaraPct > 0 ? (
                            <div>
                              <div className="text-right text-xs font-semibold tabular-nums text-amber-700 whitespace-nowrap">
                                {calc.price_base_orig > 0 ? formatCurrency(calc.effective_price_base, 0) : '—'}
                              </div>
                              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                                <input
                                  type="number"
                                  value={item.price_base || ''}
                                  onChange={(e) => handleItemChange(idx, { price_base: parseFloat(e.target.value) || 0 })}
                                  min="0" step="100" placeholder="0"
                                  className="w-20 px-1.5 py-0.5 text-[10px] text-right border border-slate-100 bg-slate-50 text-slate-400 rounded focus:outline-none focus:border-slate-300"
                                />
                                <span className="text-[9px] text-slate-400">bando</span>
                              </div>
                            </div>
                          ) : (
                            <input
                              type="number"
                              value={item.price_base || ''}
                              onChange={(e) => handleItemChange(idx, { price_base: parseFloat(e.target.value) || 0 })}
                              min="0" step="100" placeholder="0"
                              className="w-full px-2 py-1 text-xs text-right border border-slate-200 rounded focus:outline-none focus:border-indigo-300"
                            />
                          )}
                        </td>

                        {/* Mix Figure Poste + €/gg */}
                        <td className="px-3 py-3">
                          <button
                            onClick={() => toggleMix(item.id)}
                            className="w-full text-left text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1"
                          >
                            {(item.profile_mix || []).length === 0
                              ? <span className="text-slate-400 italic">Nessuna figura</span>
                              : <span className="truncate max-w-[160px]">{(item.profile_mix || []).map(e => `${e.poste_profile} ${e.pct}%`).join(' / ')}</span>
                            }
                            {mixExpanded ? <ChevronUp className="w-3 h-3 ml-auto flex-shrink-0" /> : <ChevronDown className="w-3 h-3 ml-auto flex-shrink-0" />}
                          </button>
                          <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">€/gg: {formatCurrency(calc.rate, 0)}</div>
                          {mixExpanded && (
                            <div className="mt-1">
                              <ProfileMixEditor
                                mix={item.profile_mix || []}
                                posteProfiles={posteProfiles}
                                onChange={(newMix) => handleItemChange(idx, { profile_mix: newMix })}
                              />
                            </div>
                          )}
                        </td>

                        {/* % Gruppo (INPUT) */}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number"
                              value={item.group_pct || ''}
                              onChange={(e) => handleItemPctChange(item.id, parseFloat(e.target.value) || 0)}
                              min="0" max="100" step="1" placeholder="0"
                              disabled={!calc.in_group}
                              title={!calc.in_group ? 'Assegna la voce a un raggruppamento nel tab Raggruppamenti' : undefined}
                              className={`w-14 px-1 py-1 text-xs text-center border rounded focus:outline-none
                                ${calc.in_group
                                  ? 'border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-400 font-semibold'
                                  : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                            />
                            <span className={`text-[10px] ${calc.in_group ? 'text-rose-400' : 'text-slate-300'}`}>%</span>
                          </div>
                        </td>

                        {/* FTE (derived, read-only) */}
                        <td className="px-3 py-3 text-right text-xs tabular-nums">
                          {calc.has_valid_data
                            ? <span className="font-semibold text-indigo-700">{calc.item_fte.toFixed(2)}</span>
                            : NA}
                        </td>

                        {/* Costo Tot. (derived) */}
                        <td className="px-3 py-3 text-right text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                          {calc.has_valid_data ? formatCurrency(calc.item_cost, 0) : NA}
                        </td>

                        {/* Margine Target (INPUT/override) */}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number"
                              value={calc.is_default_margin ? '' : (item.target_margin_pct ?? '')}
                              onChange={(e) => {
                                const v = e.target.value;
                                handleItemChange(idx, { target_margin_pct: v === '' ? null : Math.min(99, parseFloat(v) || 0) });
                              }}
                              placeholder={defaultTargetMarginPct.toFixed(0)}
                              min="0" max="99" step="1"
                              title={calc.is_default_margin ? `Margine target TOW: ${defaultTargetMarginPct.toFixed(1)}%` : `Override: ${calc.effective_margin.toFixed(1)}%`}
                              className={`w-14 px-1 py-1 text-xs text-center border rounded focus:outline-none
                                ${calc.is_default_margin
                                  ? 'border-slate-200 bg-slate-50 text-slate-400 placeholder:text-slate-400'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 focus:border-emerald-400 font-semibold'}`}
                            />
                            <span className="text-[10px] text-slate-400">%</span>
                          </div>
                        </td>

                        {/* Pz. Vendita Tot. (derived) */}
                        <td className="px-3 py-3 text-right text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                          {calc.has_valid_data ? formatCurrency(calc.item_sell_price, 0) : NA}
                        </td>

                        {/* Pz. Poste Tot. (derived) */}
                        <td className="px-3 py-3 text-right tabular-nums">
                          {calc.has_valid_data
                            ? <div>
                                <div className="text-xs text-slate-500 whitespace-nowrap">
                                  {formatCurrency(calc.item_poste_total, 0)}
                                </div>
                                {scontoGaraPct > 0 && calc.item_poste_total_orig > 0 && (
                                  <div className="text-[10px] text-slate-400 whitespace-nowrap">
                                    bando: {formatCurrency(calc.item_poste_total_orig, 0)}
                                  </div>
                                )}
                              </div>
                            : NA}
                        </td>

                        {/* Pz. Unitario Lutech (derived) */}
                        <td className="px-3 py-3 text-right text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                          {calc.has_valid_data && calc.item_lutech_unit > 0 ? formatCurrency(calc.item_lutech_unit, 2) : NA}
                        </td>

                        {/* Sconto % — INPUT bidirezionale con Marg.% */}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <input
                              type="number"
                              key={`sconto_${item.id}_${Math.round(calc.item_sconto_pct * 10)}`}
                              defaultValue={calc.has_valid_data ? calc.item_sconto_pct.toFixed(2) : ''}
                              disabled={!calc.has_valid_data}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v)) handleItemScontoChange(idx, v);
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                              min="-100" max="100" step="0.5"
                              className={`w-16 px-1 py-1 text-xs text-center border rounded focus:outline-none
                                ${!calc.has_valid_data
                                  ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                  : calc.item_sconto_pct < 0
                                    ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-400 font-semibold'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 focus:border-indigo-400 font-semibold'}`}
                            />
                            {calc.has_valid_data && <span className="text-[10px] text-slate-400">%</span>}
                          </div>
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-3">
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
                      </Fragment>
                    );
                  })}
                </tbody>
                {items.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-slate-700">TOTALE</td>
                      <td className="px-3 py-2"></td>{/* Pz. Unit. */}
                      <td className="px-3 py-2"></td>{/* Mix + €/gg */}
                      <td className="px-3 py-2"></td>{/* % Grp */}
                      <td className="px-3 py-2 text-right text-xs font-semibold text-indigo-700 tabular-nums">
                        {totals.totalDerivedFte.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                        {formatCurrency(totals.totalCost, 0)}
                      </td>
                      <td className="px-3 py-2"></td>{/* Marg.% */}
                      <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{formatCurrency(totals.totalSellPrice, 0)}</div>
                        <div className="text-[10px] text-slate-400">Marg: {totals.totalMarginPct.toFixed(1)}%</div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                        {formatCurrency(totals.totalPosteTotal, 0)}
                      </td>
                      <td className="px-3 py-2"></td>{/* Pz. Unit. Lu. */}
                      <td className="px-3 py-2"></td>{/* Sconto % */}
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
              <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Aggiungi voce
                  </button>
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Importa/aggiorna voci da CSV. Le voci con stessa descrizione vengono aggiornate."
                  >
                    <Upload className="w-4 h-4" />
                    Importa CSV
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleImportCSV}
                  />
                  <span className="text-xs text-slate-400 ml-1">
                    <code className="bg-slate-100 px-1 rounded">DescrizioneVoce,Tipo,Complessita,PrezzoUnitario,Ruolo1..10,Perc1..10</code>
                    &nbsp;—&nbsp;Tipo: <strong>N</strong>/M &nbsp;Compl.: <strong>L</strong>/M/H
                  </span>
                </div>

                {/* Feedback import */}
                {importFeedback && (
                  <div className={`flex flex-col gap-1 px-3 py-2 rounded-lg text-xs ${
                    importFeedback.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={importFeedback.errors.length > 0 ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>
                        {importFeedback.imported > 0 && `✓ ${importFeedback.imported} nuova${importFeedback.imported !== 1 ? 'e' : ''}`}
                        {importFeedback.updated > 0 && `${importFeedback.imported > 0 ? ' · ' : '✓ '}${importFeedback.updated} aggiornata${importFeedback.updated !== 1 ? 'e' : ''}`}
                        {importFeedback.imported === 0 && importFeedback.updated === 0 && 'Nessuna voce importata'}
                        {importFeedback.skipped > 0 && ` · ${importFeedback.skipped} riga${importFeedback.skipped !== 1 ? 'e' : ''} con errori`}
                      </span>
                      <button onClick={() => setImportFeedback(null)} className="text-slate-400 hover:text-slate-600 ml-4">✕</button>
                    </div>
                    {importFeedback.errors.length > 0 && (
                      <ul className="list-disc list-inside text-amber-600 space-y-0.5">
                        {importFeedback.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Cluster ── */}
          {activeTab === 'clusters' && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Vincoli Cluster Poste</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Definisci i cluster di figure professionali richiesti da Poste con le relative percentuali target sul totale FTE.
                  La distribuzione effettiva è pesata sugli FTE di ciascuna voce.
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
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">% Req.</th>
                        <th className="px-4 py-2 text-right font-semibold text-indigo-600" title="FTE target da bando">FTE Target</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">% Att.</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">FTE Att.</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Δ%</th>
                        <th className="px-4 py-2 text-center font-semibold text-slate-600">Stato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clusters.map(cluster => {
                        const actual = clusterDist[cluster.id] || 0;
                        const required = parseFloat(cluster.required_pct) || 0;
                        const delta = actual - required;
                        const ok = Math.abs(delta) <= 2;
                        const fteTgt = refTotalFte * required / 100;
                        const fteAtt = totals.totalDerivedFte * actual / 100;
                        return (
                          <tr key={cluster.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2">
                              <div className="font-medium text-slate-700">{cluster.label}</div>
                              <div className="text-xs text-slate-400">{(cluster.poste_profiles || []).join(', ')}</div>
                            </td>
                            <td className="px-4 py-2 text-right font-medium">{required.toFixed(0)}%</td>
                            <td className="px-4 py-2 text-right text-indigo-700 font-semibold">
                              {refTotalFte > 0 ? fteTgt.toFixed(2) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-2 text-right">{actual.toFixed(1)}%</td>
                            <td className="px-4 py-2 text-right text-slate-700">{fteAtt.toFixed(2)}</td>
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

          {/* ── Tab: Raggruppamenti ── */}
          {activeTab === 'groups' && (
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Raggruppamenti di Voci</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Ogni raggruppamento ha un <strong>valore target Poste</strong> che, in proporzione al Totale Catalogo, determina
                  gli <strong>FTE previsti</strong> per il gruppo. Per ogni voce assegnata al gruppo, definisci la
                  <strong> % sul raggruppamento</strong> (la somma deve essere 100%).
                  Il sistema calcola FTE e Prezzo Poste per voce di conseguenza.
                </p>
                <GroupEditor
                  groups={catalogGroups}
                  items={items}
                  totalCatalogValue={totalCatalogValue}
                  totalFte={refTotalFte}
                  groupTotals={groupTotals}
                  scontoGaraFactor={scontoGaraFactor}
                  onGroupsChange={(newGroups) => updateTow({ catalog_groups: newGroups })}
                  onToggleGroupItem={handleToggleGroupItem}
                  onItemPctChange={handleItemPctChange}
                  onEvenDistribute={handleEvenDistribute}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span>Voci: <strong className="text-slate-700">{items.length}</strong></span>
            <span>Gruppi: <strong className="text-slate-700">{catalogGroups.length}</strong></span>

            {/* Quadratura FTE */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold
              ${fteOk ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              FTE: {totals.totalDerivedFte.toFixed(2)}{refTotalFte > 0 && `/${refTotalFte.toFixed(2)}`}
              {refTotalFte > 0 && !fteOk && ` (Δ${fteDiff > 0 ? '+' : ''}${fteDiff.toFixed(2)})`}
            </span>

            <span>
              Costo Lu.: <strong className="text-slate-700">{formatCurrency(totals.totalCost, 0)}</strong>
            </span>
            <span>
              Pz. Vend.: <strong className="text-slate-700">{formatCurrency(totals.totalSellPrice, 0)}</strong>
            </span>
            <span className={`font-semibold ${totals.totalMarginEur >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              Marg.: {formatCurrency(totals.totalMarginEur, 0)} ({totals.totalMarginPct.toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bpSaveTrigger.fn?.()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              title="Salva il business plan"
            >
              <Save className="w-4 h-4" />
              Salva
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
