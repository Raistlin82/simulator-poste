import { useMemo } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

/**
 * ProfitAndLoss - Conto Economico di Commessa
 *
 * baseAmount e gia la base d'asta Lutech (se RTI, gia moltiplicata per quota).
 * Il BP e sempre dal punto di vista di Lutech.
 */
export default function ProfitAndLoss({
  baseAmount = 0,
  discount = 0,
  isRti = false,
  quotaLutech = 1.0,
  fullBaseAmount = 0,
  costs = {},
  cleanTeamCost = 0,
  targetMargin = 15,
  riskContingency = 0,
}) {

  const pnl = useMemo(() => {
    // baseAmount e gia la quota Lutech, sconto applicato direttamente
    const scontoAmount = baseAmount * (discount / 100);
    const revenue = baseAmount - scontoAmount;

    const { team = 0, governance = 0, risk = 0, subcontract = 0, total = 0 } = costs;

    const margin = revenue - total;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    // Saving da ottimizzazione
    const savingPct = cleanTeamCost > 0
      ? ((cleanTeamCost - team) / cleanTeamCost) * 100
      : 0;

    const effectiveTarget = targetMargin + riskContingency;

    return {
      baseAmount,
      scontoAmount,
      revenue,
      team,
      governance,
      risk,
      subcontract,
      total,
      margin,
      marginPct,
      cleanTeamCost,
      savingPct,
      effectiveTarget,
    };
  }, [baseAmount, discount, costs, cleanTeamCost, targetMargin, riskContingency]);

  const getMarginStatus = () => {
    if (pnl.marginPct >= pnl.effectiveTarget) {
      return { color: 'green', label: 'Sano', Icon: CheckCircle2 };
    }
    if (pnl.marginPct >= 0) {
      return { color: 'amber', label: 'Sotto target', Icon: AlertTriangle };
    }
    return { color: 'red', label: 'In perdita', Icon: XCircle };
  };

  const status = getMarginStatus();

  const colorClasses = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      textBold: 'text-green-800',
      icon: 'text-green-600',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      textBold: 'text-amber-800',
      icon: 'text-amber-600',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      textBold: 'text-red-800',
      icon: 'text-red-600',
    },
  };

  const sc = colorClasses[status.color];

  if (!baseAmount) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-slate-500">
        <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">Conto Economico</p>
        <p className="text-sm mt-1">Configura l'importo base d'asta del lotto per visualizzare il P&L</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-white/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-display">Conto Economico di Commessa</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest-plus mt-0.5">Sintesi P&L: ricavi, costi e margine</p>
            </div>
          </div>
          {isRti && (
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-indigo-500/5 backdrop-blur-md rounded-xl border border-indigo-100 shadow-sm font-display uppercase tracking-tighter">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold">BASE GARA TOTALE</span>
                <span className="text-xs font-black text-indigo-600">{formatCurrency(fullBaseAmount)}</span>
              </div>
              <div className="w-px h-6 bg-indigo-200" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold">QUOTA LUTECH ({(quotaLutech * 100).toFixed(0)}%)</span>
                <span className="text-xs font-black text-indigo-700">{formatCurrency(baseAmount)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Colonna RICAVI */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest-plus font-display">Ricavi</span>
            </div>

            <div className="space-y-2">
              <Row label={isRti ? 'Base d\'asta Lutech' : 'Base d\'asta'} value={pnl.baseAmount} />
              <Row label={`Sconto (${discount}%)`} value={-pnl.scontoAmount} negative />
              <Divider />
              <Row label="Revenue" value={pnl.revenue} bold />
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="text-xs text-blue-600 font-medium">Revenue Lutech</div>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(pnl.revenue)}</div>
            </div>
          </div>

          {/* Colonna COSTI */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-indigo-600" />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest-plus font-display">Costi</span>
            </div>

            <div className="space-y-2">
              {cleanTeamCost > 0 && cleanTeamCost !== pnl.team && (
                <div className="flex justify-between items-center text-sm opacity-50">
                  <span className="text-slate-500 line-through">Team (no ottimiz.)</span>
                  <span className="text-slate-400 line-through">{formatCurrency(cleanTeamCost)}</span>
                </div>
              )}
              <Row label="Costo Team" value={pnl.team} />
              <Row label="Governance" value={pnl.governance} />
              <Row label="Risk Contingency" value={pnl.risk} />
              {pnl.subcontract > 0 && (
                <Row label="Subappalto" value={pnl.subcontract} />
              )}
              <Divider />
              <Row label="Totale Costi" value={pnl.total} bold />
            </div>

            {pnl.savingPct > 0 && (
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-600">Saving da ottimizzazione</span>
                  <span className="text-sm font-bold text-emerald-700">-{pnl.savingPct.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Colonna MARGINE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <status.Icon className={`w-4 h-4 ${sc.icon}`} />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking_widest-plus font-display">Margine</span>
            </div>

            <div className={`p-4 rounded-2xl border ${sc.border} ${sc.bg} shadow-sm backdrop-blur-sm`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-widest font-display ${sc.text}`}>{status.label}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${sc.text}`}>
                  TARGET: {pnl.effectiveTarget.toFixed(0)}%
                </span>
              </div>
              <div className={`text-5xl font-black ${sc.textBold} mb-4 font-display tracking-tightest`}>
                {pnl.marginPct.toFixed(1)}%
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className={sc.text}>Revenue</span>
                  <span className={`font-semibold ${sc.textBold}`}>{formatCurrency(pnl.revenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={sc.text}>Costi</span>
                  <span className={`font-semibold ${sc.textBold}`}>{formatCurrency(pnl.total)}</span>
                </div>
                <div className={`h-px ${sc.border}`} />
                <div className="flex justify-between text-sm">
                  <span className={`font-bold ${sc.text}`}>Margine</span>
                  <span className={`font-bold text-lg ${sc.textBold}`}>{formatCurrency(pnl.margin)}</span>
                </div>
              </div>
            </div>

            {pnl.effectiveTarget > 0 && (() => {
              const barMax = Math.max(pnl.effectiveTarget, pnl.marginPct, 30);
              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0%</span>
                    <span>Target {pnl.effectiveTarget.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
                      style={{ left: `${(pnl.effectiveTarget / barMax) * 100}%` }}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${status.color === 'green' ? 'bg-green-500' :
                          status.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      style={{ width: `${Math.max(0, Math.min(pnl.marginPct, barMax)) / barMax * 100}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function Row({ label, value, negative = false, bold = false }) {
  return (
    <div className={`flex justify-between items-center text-sm ${bold ? 'pt-1' : ''}`}>
      <span className={`${bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
        {label}
      </span>
      <span className={`
        ${bold ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}
        ${negative ? 'text-red-600' : ''}
      `}>
        {negative ? '- ' : ''}{formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-200 my-1" />;
}
