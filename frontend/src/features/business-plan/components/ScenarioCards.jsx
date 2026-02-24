import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../utils/formatters';
import {
  Sparkles,
  Shield,
  Target,
  Flame,
  TrendingUp,
  Check,
  Percent,
} from 'lucide-react';

/**
 * ScenarioCards - Mostra 3 scenari con ricalcolo reale
 * Ogni scenario mostra: costo ricalcolato, margine, e sconto suggerito per target margin
 */
export default function ScenarioCards({
  scenarios = [],
  selectedScenario = null,
  onSelectScenario,
  targetMargin = 15,
  disabled = false,
}) {
  const { t } = useTranslation();

  // Explicit Tailwind class mappings (dynamic classes don't work with JIT)
  const colorClasses = {
    blue: {
      border: 'border-blue-500',
      bg: 'bg-blue-50',
      bgSolid: 'bg-blue-500',
    },
    emerald: {
      border: 'border-emerald-500',
      bg: 'bg-emerald-50',
      bgSolid: 'bg-emerald-500',
    },
    orange: {
      border: 'border-orange-500',
      bg: 'bg-orange-50',
      bgSolid: 'bg-orange-500',
    },
    slate: {
      border: 'border-slate-500',
      bg: 'bg-slate-50',
      bgSolid: 'bg-slate-500',
    },
  };

  const scenarioConfig = {
    Conservativo: {
      icon: Shield,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      description: 'Rettifiche minime, margine piu sicuro',
    },
    Bilanciato: {
      icon: Target,
      color: 'emerald',
      gradient: 'from-emerald-500 to-teal-600',
      description: 'Equilibrio tra competitivita e margine',
      recommended: true,
    },
    Aggressivo: {
      icon: Flame,
      color: 'orange',
      gradient: 'from-orange-500 to-red-500',
      description: 'Massima competitivita, margine ridotto',
    },
  };


  const formatPct = (val) => {
    return (val * 100).toFixed(0) + '%';
  };

  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="glass-card rounded-2xl">
        <div className="p-4 border-b border-slate-100 glass-card-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {t('business_plan.scenarios')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('business_plan.scenarios_desc')}
              </p>
            </div>
          </div>
        </div>
        <div className="p-8 text-center text-slate-500">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p>Configura team e parametri per generare scenari</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-white/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-display">
                {t('business_plan.scenarios')}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest-plus mt-0.5">
                {t('business_plan.scenarios_desc')}
              </p>
            </div>
          </div>
          <div className="px-4 py-2 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200/50 flex flex-col items-center">
            <span className="text-[8px] font-black uppercase tracking-widest font-display opacity-60">TARGET</span>
            <span className="text-xs font-black font-display">{targetMargin}%</span>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map(scenario => {
            const cfg = scenarioConfig[scenario.name] || {
              icon: Target,
              color: 'slate',
              gradient: 'from-slate-500 to-slate-600',
              description: '',
            };
            const Icon = cfg.icon;
            const isSelected = selectedScenario === scenario.name;
            const colors = colorClasses[cfg.color] || colorClasses.slate;

            return (
              <button
                key={scenario.name}
                onClick={() => onSelectScenario?.(scenario.name)}
                disabled={disabled}
                className={`relative p-5 rounded-2xl border transition-all text-left group
                           ${isSelected
                    ? `${colors.border} ${colors.bg} shadow-lg ring-1 ${colors.border}/20 scale-[1.02]`
                    : 'border-white/40 bg-white/20 hover:border-slate-300 hover:bg-white/40'
                  }
                           disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {/* Recommended badge */}
                {cfg.recommended && (
                  <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white
                                  text-[10px] font-bold rounded-full">
                    CONSIGLIATO
                  </div>
                )}

                {/* Selected check */}
                {isSelected && (
                  <div className={`absolute top-3 right-3 w-5 h-5 rounded-full ${colors.bgSolid}
                                   flex items-center justify-center`}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Icon & Title */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.gradient}
                                  flex items-center justify-center shadow-md shadow-black/10 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-black text-slate-800 font-display text-lg tracking-tight">{scenario.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{cfg.description}</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-2.5 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest-plus font-display">Rettifica Vol.</span>
                    <span className="font-black text-slate-700 font-display">
                      {formatPct(scenario.volume_adjustment)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest-plus font-display">Riuso</span>
                    <span className="font-black text-indigo-600 font-display">
                      {formatPct(scenario.reuse_factor)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest-plus font-display">Costo Totale</span>
                    <span className="font-black text-slate-700 font-display tabular-nums">
                      {formatCurrency(scenario.total_cost)}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Sconto suggerito per target margin */}
                  {scenario.suggested_discount !== undefined && (
                    <div className="p-3 bg-white shadow-sm rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest-plus font-display flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          Sconto per {targetMargin}% Margine
                        </span>
                        <span className="text-sm font-black text-indigo-700 font-display">
                          {scenario.suggested_discount.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Margine a 0% sconto */}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest-plus font-display">Margine (0% Sconto)</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className={`w-4 h-4 ${scenario.margin_pct >= targetMargin ? 'text-indigo-500' :
                        scenario.margin_pct >= 0 ? 'text-amber-500' : 'text-red-500'
                        }`} />
                      <span className={`text-2xl font-black font-display tracking-tightest ${scenario.margin_pct >= targetMargin ? 'text-indigo-600' :
                        scenario.margin_pct >= 0 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                        {scenario.margin_pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
