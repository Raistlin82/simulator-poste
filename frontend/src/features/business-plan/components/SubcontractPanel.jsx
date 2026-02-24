import { Building2, Percent, Users, Euro, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { useMemo } from 'react';

/**
 * SubcontractPanel - Configurazione subappalto per TOW
 *
 * Permette di specificare una % di subappalto per ogni TOW (max 20% totale)
 */
export default function SubcontractPanel({
  config = {},
  tows = [],
  teamCost = 0,
  teamMixRate = 0,
  defaultDailyRate = 250,
  maxSubcontractPct = 20,
  onChange,
  disabled = false
}) {

  const towSplit = useMemo(() => config.tow_split || {}, [config.tow_split]);
  const partner = config.partner || '';
  const avgDailyRate = config.avg_daily_rate ?? teamMixRate;

  // Quota totale = somma degli split per TOW
  const totalQuotaPct = useMemo(
    () => Object.values(towSplit).reduce((sum, val) => sum + (parseFloat(val) || 0), 0),
    [towSplit]
  );

  const handleChange = (field, value) => {
    onChange?.({ ...config, [field]: value });
  };

  const handleSplitChange = (towId, value) => {
    const newSplit = {
      ...towSplit,
      [towId]: parseFloat(value) || 0
    };
    // Rimuovi entry a 0
    if (!newSplit[towId]) {
      delete newSplit[towId];
    }
    handleChange('tow_split', newSplit);
  };

  const subcontractCost = Math.round(teamCost * (totalQuotaPct / 100));
  const isOverLimit = totalQuotaPct > maxSubcontractPct;
  const hasSubcontract = totalQuotaPct > 0;

  return (
    <div className="glass-card rounded-2xl">
      {/* Header */}
      <div className="p-5 border-b border-white/20 bg-white/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all ${isOverLimit ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20' : hasSubcontract ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/20' : 'bg-slate-200 shadow-slate-200/20'
              }`}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-display">Subappalto</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest-plus mt-0.5">
                Configura la quota di lavoro in subappalto (max {maxSubcontractPct}%)
              </p>
            </div>
          </div>

          {/* Badge quota */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition-all font-display uppercase tracking-widest text-[10px] font-black ${isOverLimit
              ? 'bg-red-50 text-red-700 border-red-100'
              : hasSubcontract
                ? 'bg-purple-50 text-purple-700 border-purple-100'
                : 'bg-slate-50 text-slate-500 border-slate-100'
            }`}>
            {isOverLimit ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : hasSubcontract ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Percent className="w-3.5 h-3.5" />
            )}
            <span>{totalQuotaPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Barra di progresso visiva */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] mb-1.5 uppercase font-black font-display tracking-widest-plus">
            <span className="text-slate-400">Quota Totale</span>
            <span className={`${isOverLimit ? 'text-red-600' : 'text-slate-500'}`}>
              {totalQuotaPct.toFixed(1)}% / {maxSubcontractPct}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isOverLimit ? 'bg-red-500' : 'bg-purple-500'
                }`}
              style={{ width: `${maxSubcontractPct > 0 ? Math.min(100, (totalQuotaPct / maxSubcontractPct) * 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Distribuzione per TOW */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Percent className="w-4 h-4 text-slate-400" />
            Distribuzione per TOW
          </div>

          {tows.length === 0 ? (
            <div className="text-sm text-slate-400 italic p-3 bg-slate-50 rounded-lg text-center">
              Configura prima i TOW nel tab Poste
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              {tows.map(tow => {
                const splitValue = towSplit[tow.tow_id] || 0;
                const hasValue = splitValue > 0;
                return (
                  <div
                    key={tow.tow_id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${hasValue ? 'bg-purple-50' : 'bg-white'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${hasValue ? 'bg-purple-500' : 'bg-slate-300'}`} />
                    <span className={`flex-1 text-sm font-medium ${hasValue ? 'text-purple-700' : 'text-slate-600'}`}>
                      {tow.label || tow.tow_id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={splitValue || ''}
                        onChange={e => handleSplitChange(tow.tow_id, e.target.value)}
                        disabled={disabled}
                        min="0"
                        max={maxSubcontractPct}
                        step="1"
                        placeholder="0"
                        className={`w-16 px-2 py-1.5 text-center text-sm font-semibold border rounded-lg
                                   focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-200
                                   disabled:bg-slate-100 disabled:cursor-not-allowed transition-colors ${hasValue ? 'border-purple-300 bg-white' : 'border-slate-200 bg-white'
                          }`}
                      />
                      <span className="text-xs font-medium text-slate-400 w-4">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sezione Dati Partner - visibile solo se c'è subappalto */}
        {hasSubcontract && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Users className="w-4 h-4 text-slate-400" />
              Dati Partner
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome Partner */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Nome Partner
                </label>
                <input
                  type="text"
                  value={partner}
                  onChange={(e) => handleChange('partner', e.target.value)}
                  disabled={disabled}
                  placeholder="Es: Acme S.r.l."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                             disabled:bg-slate-50 disabled:cursor-not-allowed
                             placeholder:text-slate-300"
                />
              </div>

              {/* Costo medio €/giorno */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Euro className="w-3 h-3" />
                  Costo Medio Giornaliero
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={avgDailyRate || ''}
                    onChange={(e) => handleChange('avg_daily_rate', parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    min="0"
                    step="10"
                    placeholder={teamMixRate > 0 ? teamMixRate.toFixed(0) : defaultDailyRate.toFixed(0)}
                    className="w-full px-3 py-2.5 pr-12 text-sm text-right border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                               disabled:bg-slate-50 disabled:cursor-not-allowed
                               placeholder:text-slate-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                    €/gg
                  </span>
                </div>
                {teamMixRate > 0 && !config.avg_daily_rate && (
                  <div className="text-[10px] text-slate-400">
                    Default: {formatCurrency(teamMixRate)}/gg (nostro pay mix)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Riepilogo Costo - visibile solo se c'è subappalto */}
        {hasSubcontract && (
          <div className={`p-5 rounded-2xl border transition-all shadow-lg backdrop-blur-md ${isOverLimit
              ? 'bg-red-500/5 border-red-200'
              : 'bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border-purple-200'
            }`}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className={`text-[10px] font-black uppercase tracking-widest-plus font-display ${isOverLimit ? 'text-red-600' : 'text-purple-600'
                  }`}>
                  Costo Subappalto Stimato
                </div>
                <div className={`text-[9px] font-bold ${isOverLimit ? 'text-red-500/60' : 'text-purple-500/60'}`}>
                  {totalQuotaPct.toFixed(1)}% DEL COSTO TEAM ({formatCurrency(teamCost)})
                </div>
              </div>
              <div className={`text-4xl font-black font-display tracking-tightest tabular-nums ${isOverLimit ? 'text-red-700' : 'text-purple-700'
                }`}>
                {formatCurrency(subcontractCost)}
              </div>
            </div>

            {isOverLimit && (
              <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-100 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>La quota totale supera il limite massimo del {maxSubcontractPct}%</span>
              </div>
            )}
          </div>
        )}

        {/* Stato vuoto */}
        {!hasSubcontract && tows.length > 0 && (
          <div className="text-center py-4 text-slate-400 text-sm">
            Imposta una % su almeno un TOW per attivare il subappalto
          </div>
        )}
      </div>
    </div>
  );
}
