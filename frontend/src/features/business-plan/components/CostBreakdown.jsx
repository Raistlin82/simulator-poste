import { useMemo, useState, Fragment } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Users,
  Shield,
  AlertTriangle,
  Building,
  TrendingDown,
  Calculator,
  User,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar
} from 'lucide-react';

export default function CostBreakdown({
  costs = {},
  towBreakdown = {},
  lutechProfileBreakdown = {},
  teamMixRate = 0,
  showTowDetail = true,
  durationMonths = 36,
  startYear = null,
  startMonth = null,
  inflationPct = 0,
  catalogCost = 0,
  catalogDetail = null,
}) {
  const { t } = useTranslation();
  const [expandedTows, setExpandedTows] = useState(new Set());
  const [expandedProfiles, setExpandedProfiles] = useState(new Set());
  const [viewMode, setViewMode] = useState('total'); // 'total' | 'yearly'

  const toggleTow = (id) => {
    const next = new Set(expandedTows);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedTows(next);
  };

  const toggleProfile = (id) => {
    const next = new Set(expandedProfiles);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedProfiles(next);
  };

  const {
    team = 0,
    governance = 0,
    risk = 0,
    subcontract = 0,
    total = 0
  } = costs;

  // Calcola percentuali
  const breakdown = useMemo(() => {
    if (total === 0) return [];

    const items = [
      { key: 'team', label: 'Costo Team (FTE)', value: team, icon: Users, color: 'blue' },
    ];

    if (catalogCost > 0) {
      items.push({ key: 'catalog', label: 'Catalogo - FTE Delivery', value: catalogCost, icon: Calculator, color: 'rose' });
    }

    items.push(
      { key: 'governance', label: 'Governance', value: governance, icon: Shield, color: 'indigo' },
      { key: 'risk', label: 'Risk Contingency', value: risk, icon: AlertTriangle, color: 'amber' },
    );

    if (subcontract > 0) {
      items.push({ key: 'subcontract', label: 'Subappalto', value: subcontract, icon: Building, color: 'purple' });
    }

    return items.map(item => ({
      ...item,
      pct: (item.value / total) * 100
    }));
  }, [team, catalogCost, governance, risk, subcontract, total]);

  // Calcola breakdown annuale
  const yearlyBreakdown = useMemo(() => {
    if (!startYear || !startMonth || durationMonths <= 0) return [];

    // Calcola gli anni interessati e i mesi per ciascuno
    const years = [];
    let currentYear = startYear;
    let currentMonth = startMonth;
    let remainingMonths = durationMonths;

    while (remainingMonths > 0) {
      const monthsInThisYear = Math.min(13 - currentMonth, remainingMonths);
      const yearData = years.find(y => y.year === currentYear);

      if (yearData) {
        yearData.months += monthsInThisYear;
      } else {
        years.push({
          year: currentYear,
          months: monthsInThisYear,
          startMonth: currentMonth,
          endMonth: currentMonth + monthsInThisYear - 1
        });
      }

      remainingMonths -= monthsInThisYear;
      currentMonth = 1;
      currentYear++;
    }

    // Distribuisci i costi proporzionalmente ai mesi
    return years.map(yearData => {
      const yearFraction = yearData.months / durationMonths;
      return {
        year: yearData.year,
        months: yearData.months,
        startMonth: yearData.startMonth,
        endMonth: yearData.endMonth,
        team: team * yearFraction,
        catalog: catalogCost * yearFraction,
        governance: governance * yearFraction,
        risk: risk * yearFraction,
        subcontract: subcontract * yearFraction,
        total: total * yearFraction
      };
    });
  }, [team, catalogCost, governance, risk, subcontract, total, durationMonths, startYear, startMonth]);

  // Ordina TOW per costo
  const towItems = useMemo(() => {
    return Object.entries(towBreakdown)
      .map(([towId, data]) => ({ towId, cost: data.cost ?? data, label: data.label ?? towId, contributions: data.contributions || [] }))
      .sort((a, b) => b.cost - a.cost);
  }, [towBreakdown]);
  // Ordina profili Lutech per costo
  const profileItems = useMemo(() => {
    return Object.entries(lutechProfileBreakdown)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.cost - a.cost);
  }, [lutechProfileBreakdown]);
  const colorMap = {
    blue: { bar: 'bg-blue-500', bg: 'bg-blue-100', text: 'text-blue-700' },
    indigo: { bar: 'bg-indigo-500', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    amber: { bar: 'bg-amber-500', bg: 'bg-amber-100', text: 'text-amber-700' },
    purple: { bar: 'bg-purple-500', bg: 'bg-purple-100', text: 'text-purple-700' },
    emerald: { bar: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    rose: { bar: 'bg-rose-500', bg: 'bg-rose-100', text: 'text-rose-700' },
  };

  // Colori per TOW (ciclici)
  const towColors = ['blue', 'indigo', 'purple', 'emerald', 'amber'];

  const [expandedMain, setExpandedMain] = useState(new Set());
  const toggleMain = (key) => {
    const next = new Set(expandedMain);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedMain(next);
  };

  const [expandedYears, setExpandedYears] = useState(new Set());
  const toggleYear = (year) => {
    const next = new Set(expandedYears);
    if (next.has(year)) next.delete(year); else next.add(year);
    setExpandedYears(next);
  };

  return (
    <div className="glass-card rounded-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 glass-card-header">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {t('business_plan.cost_breakdown')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('business_plan.cost_breakdown_desc')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider tracking-tighter">Totale BP (IVA escl.)</div>
            <div className="text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(total)}</div>
          </div>
        </div>

        {/* Toggle Vista: Totale / Annuale */}
        {yearlyBreakdown.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('total')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'total'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Vista Totale
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'yearly'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3 h-3" />
              Vista Annuale ({yearlyBreakdown.length} anni)
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
        {total === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>Nessun dato di costo disponibile</p>
            <p className="text-xs mt-1">Configura team e parametri per vedere il breakdown</p>
          </div>
        ) : viewMode === 'yearly' && yearlyBreakdown.length > 0 ? (
          /* Vista Annuale */
          <div className="space-y-4">
            <div className="text-xs text-slate-500 italic mb-3">
              I costi sono ripartiti proporzionalmente ai mesi di ciascun anno. Clicca su un anno per vedere il dettaglio.
              {inflationPct > 0 && (
                <span className="ml-1 text-violet-600 not-italic font-medium">
                  Le tariffe Lutech incluono escalation YoY del {inflationPct}% — il badge ×N indica il moltiplicatore applicato alle tariffe di quell'anno.
                </span>
              )}
            </div>
            {yearlyBreakdown.map((yearData, idx) => {
              const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
              const yearFraction = yearData.months / durationMonths;
              const isYearExpanded = expandedYears.has(yearData.year);

              const yearBreakdown = [
                { key: 'team', label: 'Costo Team', value: yearData.team, icon: Users, color: 'blue' },
              ];
              if (yearData.catalog > 0) {
                yearBreakdown.push({ key: 'catalog', label: 'Catalogo', value: yearData.catalog, icon: Calculator, color: 'rose' });
              }
              yearBreakdown.push(
                { key: 'governance', label: 'Governance', value: yearData.governance, icon: Shield, color: 'indigo' },
                { key: 'risk', label: 'Risk Contingency', value: yearData.risk, icon: AlertTriangle, color: 'amber' },
              );
              if (yearData.subcontract > 0) {
                yearBreakdown.push({ key: 'subcontract', label: 'Subappalto', value: yearData.subcontract, icon: Building, color: 'purple' });
              }

              // TOW breakdown proporzionale all'anno
              const yearTowItems = Object.entries(towBreakdown)
                .map(([towId, data]) => ({
                  towId,
                  label: data.label ?? towId,
                  cost: (data.cost ?? 0) * yearFraction
                }))
                .filter(t => t.cost > 0)
                .sort((a, b) => b.cost - a.cost);

              // Profili Lutech proporzionali all'anno
              const yearProfileItems = Object.entries(lutechProfileBreakdown)
                .map(([id, data]) => ({
                  id,
                  label: data.label ?? id,
                  practice: data.practice ?? '',
                  cost: (data.cost ?? 0) * yearFraction,
                  days: (data.days ?? 0) * yearFraction,
                  rate: data.rate ?? 0
                }))
                .filter(p => p.cost > 0)
                .sort((a, b) => b.cost - a.cost);

              const yearIndex = startYear ? yearData.year - startYear : idx;
              const yearInflationFactor = inflationPct > 0 ? Math.pow(1 + inflationPct / 100, yearIndex) : null;

              return (
                <div key={idx} className={`rounded-xl border transition-all ${isYearExpanded ? 'border-emerald-300 shadow-md' : 'border-slate-200'} bg-slate-50`}>
                  {/* Header Anno — cliccabile */}
                  <button
                    type="button"
                    onClick={() => toggleYear(yearData.year)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-800">{yearData.year}</span>
                        {yearInflationFactor !== null && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                            Tariffa ×{yearInflationFactor.toFixed(3)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {monthNames[yearData.startMonth - 1]} - {monthNames[yearData.endMonth - 1]} ({yearData.months} mesi)
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase font-bold">Totale Anno</div>
                        <div className="text-lg font-bold text-emerald-600">{formatCurrency(yearData.total)}</div>
                      </div>
                      <div className="text-slate-400">
                        {isYearExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </button>

                  {/* Barra breakdown anno (sempre visibile) */}
                  <div className="h-3 rounded-b-none rounded-t-none overflow-hidden flex mx-4 mb-3">
                    {yearBreakdown.map((item) => {
                      const pct = yearData.total > 0 ? (item.value / yearData.total) * 100 : 0;
                      return (
                        <div
                          key={item.key}
                          className={`${colorMap[item.color].bar} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })}
                  </div>

                  {/* Dettaglio voci anno (sempre visibili) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4">
                    {yearBreakdown.map(item => (
                      <div key={item.key} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                        <div className={`w-8 h-8 rounded-lg ${colorMap[item.color].bg} flex items-center justify-center flex-shrink-0`}>
                          <item.icon className={`w-4 h-4 ${colorMap[item.color].text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-slate-500 truncate">{item.label}</div>
                          <div className="text-sm font-bold text-slate-800 truncate">{formatCurrency(item.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dettaglio espanso: TOW + Profili */}
                  {isYearExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-slate-200 pt-4">
                      {/* TOW Breakdown */}
                      {yearTowItems.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5" />
                            Costi per Type of Work — {yearData.year}
                          </h5>
                          <div className="space-y-1.5">
                            {yearTowItems.map((item, tidx) => {
                              const color = towColors[tidx % towColors.length];
                              const pct = yearData.total > 0 ? (item.cost / yearData.total) * 100 : 0;
                              return (
                                <div key={item.towId} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                  <div className={`w-2.5 h-2.5 rounded-full ${colorMap[color].bar} shrink-0`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-xs font-medium text-slate-700 truncate">{item.label}</span>
                                      <span className="text-xs font-bold text-slate-800 ml-2">{formatCurrency(item.cost)}</span>
                                    </div>
                                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${colorMap[color].bar}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Profili Lutech */}
                      {yearProfileItems.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            Profili Lutech — {yearData.year}
                          </h5>
                          <div className="overflow-hidden border border-slate-100 rounded-lg">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50 text-slate-400 font-semibold">
                                <tr>
                                  <th className="px-2 py-1.5">Profilo</th>
                                  <th className="px-2 py-1.5 text-center">GG</th>
                                  <th className="px-2 py-1.5 text-right">Tariffa</th>
                                  <th className="px-2 py-1.5 text-right">Costo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {yearProfileItems.map(item => (
                                  <tr key={item.id} className="bg-white">
                                    <td className="px-2 py-1.5">
                                      <div className="font-medium text-slate-700">{item.label}</div>
                                      <div className="text-[9px] text-slate-400 uppercase">{item.practice}</div>
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-slate-600 font-bold">{item.days.toFixed(1)}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-500 italic">{formatCurrency(item.rate)}</td>
                                    <td className="px-2 py-1.5 text-right font-semibold text-slate-800">{formatCurrency(item.cost)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra totale */}
            <div className="h-8 rounded-lg overflow-hidden flex shadow-inner">
              {breakdown.map((item) => (
                <div
                  key={item.key}
                  className={`${colorMap[item.color].bar} transition-all relative group cursor-help`}
                  style={{ width: `${item.pct}%` }}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            {/* Dettaglio voci con Esplosione */}
            <div className="space-y-3">
              {breakdown.map(item => {
                const isExpanded = expandedMain.has(item.key);
                const expl = costs.explanation?.[item.key];

                return (
                  <div key={item.key} className="flex flex-col">
                    <div
                      onClick={() => toggleMain(item.key)}
                      className={`flex items-center gap-4 p-2 rounded-xl transition-all cursor-pointer hover:bg-slate-50 ${isExpanded ? 'bg-slate-50 ring-1 ring-slate-100 mb-1' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${colorMap[item.color].bg} flex items-center justify-center`}>
                        <item.icon className={`w-5 h-5 ${colorMap[item.color].text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-slate-700">{item.label}</span>
                          <span className="text-sm font-bold text-slate-800 tracking-tight">{formatCurrency(item.value)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colorMap[item.color].bar} transition-all`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-bold ${colorMap[item.color].text} w-10 text-right`}>
                          {item.pct.toFixed(1)}%
                        </span>
                        <div className="text-slate-300">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Explosion View */}
                    {isExpanded && (
                      <div className="ml-14 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm text-xs space-y-2">
                          {item.key === 'team' && (
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-2 text-blue-600 font-bold mb-0">
                                <Users className="w-3.5 h-3.5" />
                                Formula di Calcolo
                              </div>
                              <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[10px] text-slate-600">
                                &sum; (GG Effettivi * Tariffa Lutech) per ogni Membro/Intervallo
                              </div>
                              {inflationPct > 0 && (
                                <div className="bg-violet-50 border border-violet-200 rounded p-2 text-[10px] text-violet-700 space-y-1">
                                  <div className="font-semibold flex items-center gap-1">
                                    <span>Escalation Inflazione YoY: {inflationPct}%/anno</span>
                                  </div>
                                  <div className="font-mono text-violet-600">
                                    Tariffa Anno N = Tariffa Base × (1 + {inflationPct}%)^N
                                  </div>
                                  <div className="text-violet-500">
                                    Anno 1: ×1.000 · Anno 2: ×{Math.pow(1 + inflationPct / 100, 1).toFixed(3)} · Anno 3: ×{Math.pow(1 + inflationPct / 100, 2).toFixed(3)}
                                  </div>
                                </div>
                              )}

                              {/* TOW Breakdown (nested) */}
                              {showTowDetail && towItems.length > 0 && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                      <TrendingDown className="w-3 h-3" />
                                      Costi per Type of Work
                                    </div>
                                    {teamMixRate > 0 && (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                                        Mix: {formatCurrency(teamMixRate)}/gg
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-1.5">
                                    {towItems.map((towItem, tidx) => {
                                      const color = towColors[tidx % towColors.length];
                                      const pct = total > 0 ? (towItem.cost / total) * 100 : 0;
                                      const isTowExpanded = expandedTows.has(towItem.towId);
                                      return (
                                        <Fragment key={towItem.towId}>
                                          <div
                                            onClick={() => toggleTow(towItem.towId)}
                                            className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white ${isTowExpanded ? 'bg-white ring-1 ring-slate-100' : ''}`}
                                          >
                                            <div className={`w-2 h-2 rounded ${colorMap[color].bar} shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs font-medium text-slate-700 truncate">{towItem.label}</span>
                                                <span className="text-xs font-bold text-slate-800 ml-2">{formatCurrency(towItem.cost)}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                  <div className={`h-full ${colorMap[color].bar}`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-[9px] text-slate-400 w-8 text-right">{pct.toFixed(1)}%</span>
                                              </div>
                                            </div>
                                            <div className="text-slate-300">
                                              {isTowExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </div>
                                          </div>
                                          {isTowExpanded && towItem.contributions.length > 0 && (
                                            <div className="ml-4 mt-0.5 mb-1.5 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-1">
                                              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                <Info className="w-3 h-3" />
                                                Calcolo Contributi Team
                                              </div>
                                              <div className="p-3 space-y-2">
                                                {towItem.contributions.map((c, cIdx) => (
                                                  <div key={cIdx} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-[11px] space-y-2">
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">{c.memberLabel}</span>
                                                        <span className="text-[9px] text-slate-400 font-medium">{c.profileLabel}</span>
                                                      </div>
                                                      <div className="text-right">
                                                        <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded tracking-tight">Alloc. {c.allocationPct}%</span>
                                                      </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-1 items-stretch">
                                                      <div className="flex flex-col bg-slate-50 p-1.5 rounded border border-slate-100 mb-0.5">
                                                        <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                                                          <span>1. Rettifica Profilo</span>
                                                          <span className="font-bold text-emerald-600">-{Number(c.reductions?.profile || 0).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                          <span className="text-slate-400">GG Iniz: {Number(c.daysRaw).toFixed(2)}</span>
                                                          <span className="font-bold text-slate-600 tracking-tight text-[10px]">&rarr; GG Base: {Number(c.daysBase).toFixed(2)}</span>
                                                        </div>
                                                      </div>
                                                      <div className="flex flex-col bg-blue-50/50 p-1.5 rounded border border-blue-100/50 mb-0.5">
                                                        <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                                                          <span>2. Efficienza (TOW {c.reductions?.tow > 0 ? `-${c.reductions.tow.toFixed(1)}%` : '0%'} + Riuso {c.reductions?.reuse > 0 ? `-${c.reductions.reuse.toFixed(1)}%` : '0%'})</span>
                                                          <span className="font-bold text-blue-600">Fattore: {Number(c.efficiencyFactor || 1).toFixed(3)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                          <span className="text-slate-400">GG Base: {Number(c.daysBase).toFixed(2)}</span>
                                                          <span className="font-bold text-emerald-700 tracking-tight text-[10px]">&rarr; GG Effettivi: {Number(c.days).toFixed(2)}</span>
                                                        </div>
                                                      </div>
                                                      <div className="flex justify-between px-1.5 py-1 bg-amber-50/30 rounded border border-amber-100/30">
                                                        <span className="text-slate-500">3. Tariffa: {formatCurrency(c.rate)}/gg</span>
                                                        <span className="font-medium text-slate-700">{Number(c.days).toFixed(2)} * {c.rate}</span>
                                                      </div>
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-50 text-right font-bold text-slate-800">
                                                      Quotato: {formatCurrency(c.cost)}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Lutech Profiles (nested) */}
                              {profileItems.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                                    <User className="w-3 h-3" />
                                    Dettaglio Profili Lutech
                                  </div>
                                  <div className="overflow-hidden border border-slate-100 rounded-xl">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-slate-50 text-slate-500 font-semibold">
                                        <tr>
                                          <th className="px-3 py-2">Profilo</th>
                                          <th className="px-3 py-2 text-center">GG</th>
                                          <th className="px-3 py-2 text-right">Tariffa</th>
                                          <th className="px-3 py-2 text-right">Costo</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {profileItems.map(pItem => {
                                          const isExpanded = expandedProfiles.has(pItem.id);
                                          return (
                                            <Fragment key={pItem.id}>
                                              <tr
                                                onClick={() => toggleProfile(pItem.id)}
                                                className={`hover:bg-slate-50 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                                              >
                                                <td className="px-3 py-2">
                                                  <div className="flex items-center gap-2">
                                                    <div className="text-slate-300">
                                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    </div>
                                                    <div className="flex-1">
                                                      <div className="font-medium text-slate-700">{pItem.label}</div>
                                                      <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{pItem.practice}</div>
                                                    </div>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 text-center text-slate-600">
                                                  <div className="flex flex-col items-center">
                                                    <span className="font-bold text-slate-700">{Number(pItem.days).toFixed(2)}</span>
                                                    <span className="text-[9px] text-slate-400 line-through">{Number(pItem.daysBase).toFixed(2)}</span>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-500 italic">{formatCurrency(pItem.rate)}</td>
                                                <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(pItem.cost)}</td>
                                              </tr>
                                              {isExpanded && pItem.contributions && (
                                                <tr className="bg-white">
                                                  <td colSpan={4} className="px-8 py-3 bg-slate-50/30">
                                                    <div className="border-l-2 border-emerald-200 pl-4 space-y-2">
                                                      <div className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5 mb-2">
                                                        <Calculator className="w-3 h-3" />
                                                        Logica di Calcolo: GG * Tariffa
                                                      </div>
                                                      {pItem.contributions.map((c, cIdx) => (
                                                        <div key={cIdx} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-[11px]">
                                                          <div className="flex items-center justify-between mb-1.5">
                                                            <span className="font-bold text-slate-700">{c.memberLabel}</span>
                                                            <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Mesi {c.months}</span>
                                                          </div>
                                                          <div className="grid grid-cols-1 gap-1 items-stretch">
                                                            <div className="flex flex-col bg-slate-50 p-1.5 rounded border border-slate-100 mb-0.5">
                                                              <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                                                                <span>1. Rettifica Profilo</span>
                                                                <span className="font-bold text-emerald-600">-{c.reductions?.profile?.toFixed(1)}%</span>
                                                              </div>
                                                              <div className="flex justify-between items-center">
                                                                <span className="text-slate-400">GG Iniziali: {Number(c.daysRaw || (c.daysBase / (c.profileFactor || 1))).toFixed(2)}</span>
                                                                <span className="font-bold text-slate-600 tracking-tight text-[10px]">&rarr; GG Base: {Number(c.daysBase).toFixed(2)}</span>
                                                              </div>
                                                            </div>
                                                            <div className="flex flex-col bg-blue-50/50 p-1.5 rounded border border-blue-100/50 mb-0.5">
                                                              <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                                                                <span>2. Efficienza (TOW {c.reductions?.tow > 0 ? `-${c.reductions.tow.toFixed(1)}%` : '0%'} + Riuso {c.reductions?.reuse > 0 ? `-${c.reductions.reuse.toFixed(1)}%` : '0%'})</span>
                                                                <span className="font-bold text-blue-600">Fattore: {Number(c.efficiencyFactor || 1).toFixed(3)}</span>
                                                              </div>
                                                              <div className="flex justify-between items-center">
                                                                <span className="text-slate-400">GG Base: {Number(c.daysBase).toFixed(2)}</span>
                                                                <span className="font-bold text-emerald-700 tracking-tight text-[10px]">&rarr; GG Effettivi: {Number(c.days).toFixed(2)}</span>
                                                              </div>
                                                            </div>
                                                            <div className="flex justify-between px-1.5 py-1 bg-amber-50/30 rounded border border-amber-100/30">
                                                              <span className="text-slate-500">3. Tariffa: {formatCurrency(c.rate)}/gg</span>
                                                              <span className="font-medium text-slate-700">{Number(c.days).toFixed(2)} * {c.rate}</span>
                                                            </div>
                                                          </div>
                                                          <div className="mt-2 pt-1 border-t border-slate-50 text-right font-bold text-slate-800">
                                                            Contributo: {formatCurrency(c.cost)}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {item.key === 'governance' && expl && (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-indigo-600 font-bold mb-1">
                                <Shield className="w-3.5 h-3.5" />
                                Dettaglio Calcolo Governance
                              </div>
                              {expl.method === 'mix_profili' ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between p-1.5 bg-indigo-50/50 rounded border border-indigo-100">
                                    <span className="text-slate-500 italic">FTE Governance:</span>
                                    <span className="font-bold text-indigo-700">{expl.fte.toFixed(1)} FTE</span>
                                  </div>
                                  <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[10px] text-slate-600 leading-relaxed">
                                    {expl.fte.toFixed(1)} FTE * {expl.daysPerFte} GG/anno * {expl.years.toFixed(1)} anni * {formatCurrency(expl.avgRate)}/gg (avg)
                                    <br />
                                    = {formatCurrency(item.value)}
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[10px] text-slate-600">
                                  Base costo ({formatCurrency(team + catalogCost)}) * {expl.pct}%
                                  <br />
                                  = {formatCurrency(item.value)}
                                </div>
                              )}
                            </div>
                          )}

                          {item.key === 'risk' && expl && (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-amber-600 font-bold mb-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Calcolo Risk Contingency
                              </div>
                              <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[10px] text-slate-600">
                                (Base costo + Governance) * {expl.pct}% (Risk Factor)
                                <br />
                                ({formatCurrency(team + catalogCost)} + {formatCurrency(governance)}) * {expl.pct}%
                                <br />
                                = {formatCurrency(item.value)}
                              </div>
                            </div>
                          )}

                          {item.key === 'subcontract' && expl && (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-purple-600 font-bold mb-1">
                                <Building className="w-3.5 h-3.5" />
                                Dettaglio Subappalto
                              </div>
                              <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-2">
                                <div className="font-mono text-[10px] text-slate-600">
                                  Base costo ({formatCurrency(team + catalogCost)}) * {expl.pct}% (Quota totale)
                                  <br />
                                  = {formatCurrency(item.value)}
                                </div>
                                {expl.partner && (
                                  <div className="text-[10px] text-purple-700">
                                    <span className="font-semibold">Partner:</span> {expl.partner}
                                  </div>
                                )}
                                {expl.avg_daily_rate > 0 && (
                                  <div className="text-[10px] text-purple-700">
                                    <span className="font-semibold">Costo medio partner:</span> {formatCurrency(expl.avg_daily_rate)}/gg
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {item.key === 'catalog' && catalogDetail && (
                            <div className="flex flex-col gap-3">
                              {catalogDetail.byTow.map((towData, ti) => (
                                <div key={ti} className="border border-rose-100 rounded-xl overflow-hidden">
                                  {/* TOW Header */}
                                  <div className="px-3 py-2 bg-rose-50 flex items-center justify-between">
                                    <span className="font-semibold text-rose-800 text-xs">{towData.label}</span>
                                    <div className="flex gap-3 text-[10px]">
                                      <span className="text-slate-500">{formatCurrency(towData.revenue)} ricavi Lu.</span>
                                      <span className="font-bold text-slate-700">{formatCurrency(towData.cost)} costo Lu.</span>
                                    </div>
                                  </div>

                                  {/* Items table */}
                                  {towData.items.length > 0 && (
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50 text-slate-400 font-semibold">
                                        <tr>
                                          <th className="px-3 py-1.5 text-left">Voce</th>
                                          <th className="px-3 py-1.5 text-right">FTE</th>
                                          <th className="px-3 py-1.5 text-right">Pz. Poste Tot.</th>
                                          <th className="px-3 py-1.5 text-right">Costo Lu.</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {towData.items.map((it, ii) => (
                                          <tr key={ii} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-1.5">
                                              <div className="font-medium text-slate-700">{it.label || '—'}</div>
                                              <div className="text-[10px] text-slate-400">{it.tipo} · {it.complessita}</div>
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{(it.fte ?? 0).toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-600">{formatCurrency(it.poste_total ?? 0, 0)}</td>
                                            <td className="px-3 py-1.5 text-right font-medium text-slate-700">{formatCurrency(it.lutech_cost, 0)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}

                                  {/* Raggruppamenti */}
                                  {towData.groups.length > 0 && (
                                    <div className="px-3 py-2 border-t border-slate-100">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Raggruppamenti</div>
                                      <div className="space-y-1">
                                        {towData.groups.map((g, gi) => (
                                          <div key={gi} className="flex justify-between items-center text-xs py-0.5">
                                            <span className="text-slate-700 font-medium">{g.label}</span>
                                            <div className="flex gap-3 text-[10px]">
                                              <span className="text-slate-400">{formatCurrency(g.target_value ?? 0, 0)} target</span>
                                              <span className="font-medium text-slate-600">{formatCurrency(g.lutech_cost, 0)} costo</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Cluster distribution */}
                                  {towData.clusters.length > 0 && (
                                    <div className="px-3 py-2 border-t border-slate-100">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Distribuzione Cluster</div>
                                      <div className="space-y-1">
                                        {towData.clusters.map((c, ci) => (
                                          <div key={ci} className="flex items-center gap-2 text-[10px]">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                                            <span className="flex-1 text-slate-600">{c.label}</span>
                                            <span className="text-slate-400">{c.required_pct}% req.</span>
                                            <span className={`font-semibold ${c.ok ? 'text-green-700' : 'text-red-700'}`}>
                                              {(c.actual_pct ?? 0).toFixed(1)}% att.
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
