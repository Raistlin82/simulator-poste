import { useState } from 'react';
import { Table, Euro, Calculator, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

const TYPE_CONFIG = {
  task: { label: 'Task', cls: 'bg-blue-100 text-blue-700' },
  corpo: { label: 'A Corpo', cls: 'bg-purple-100 text-purple-700' },
  canone: { label: 'Canone', cls: 'bg-green-100 text-green-700' },
  consumo: { label: 'Consumo', cls: 'bg-amber-100 text-amber-700' },
  catalogo: { label: 'Catalogo', cls: 'bg-rose-100 text-rose-700' },
};

/**
 * OfferSchemeTable - Tabella Schema di Offerta (PxQ)
 * Per TOW tipo catalogo: riga espandibile con dettaglio per raggruppamento e voce.
 */
export default function OfferSchemeTable({
  offerData = [],
  totalOffer = 0,
}) {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (towId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(towId)) next.delete(towId); else next.add(towId);
      return next;
    });
  };

  const formatNumber = (val) =>
    new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(val ?? 0);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 glass-card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Table className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Schema di Offerta</h3>
            <p className="text-xs text-slate-500">
              Dettaglio prezzi unitari e totali per Type of Work (PxQ)
            </p>
          </div>
        </div>
      </div>

      {/* Tabella */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 w-24">TOW ID</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Descrizione</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 w-24">Tipo</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 w-28">Quantità</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600 w-32">Prezzo Unitario</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600 w-32">Prezzo Totale</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {offerData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Calculator className="w-8 h-8 text-slate-300" />
                    <p>Nessun dato disponibile per l'offerta</p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {offerData.map((row, idx) => {
                  const typeCfg = TYPE_CONFIG[row.type] || { label: row.type || 'Consumo', cls: 'bg-amber-100 text-amber-700' };
                  const isCatalog = row.type === 'catalogo' && row.catalog_detail;
                  const isExpanded = expandedRows.has(row.tow_id);

                  return (
                    <>
                      <tr
                        key={`row-${idx}`}
                        onClick={() => isCatalog && toggleRow(row.tow_id)}
                        className={`hover:bg-slate-50 transition-colors ${isCatalog ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-700">{row.tow_id}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="flex items-center gap-2">
                            {isCatalog && (
                              <BookOpen className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                            )}
                            {row.label}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${typeCfg.cls}`}>
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-700">
                          {isCatalog ? (
                            <span>
                              {formatNumber(row.quantity)}
                              <span className="block text-[10px] text-slate-400 font-sans">voci</span>
                            </span>
                          ) : (
                            <span>
                              {formatNumber(row.quantity)}
                              <span className="block text-[10px] text-slate-400 font-sans">
                                {row.type === 'task' ? 'task' :
                                  row.type === 'corpo' ? 'mesi (forfait)' :
                                    row.type === 'canone' ? 'mesi (canone)' : 'forfait'}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {row.unit_price != null ? formatCurrency(row.unit_price) : <span className="text-slate-400 text-xs">Per voce</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {formatCurrency(row.total_price)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isCatalog && (
                            isExpanded
                              ? <ChevronUp className="w-4 h-4 text-rose-500 mx-auto" />
                              : <ChevronDown className="w-4 h-4 text-slate-400 mx-auto" />
                          )}
                        </td>
                      </tr>

                      {/* Dettaglio catalogo espanso */}
                      {isCatalog && isExpanded && (
                        <tr key={`detail-${idx}`} className="bg-rose-50/20">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-5">
                              {/* Raggruppamenti */}
                              {(row.catalog_detail.groups || []).map((group, gIdx) => (
                                <div key={group.id || gIdx}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-rose-700 px-2 py-0.5 bg-rose-100 rounded">
                                      {group.label}
                                    </span>
                                    {group.target_value > 0 && (
                                      <span className="text-[10px] text-slate-500">
                                        Target: {formatCurrency(group.target_value, 0)}
                                      </span>
                                    )}
                                  </div>
                                  <table className="w-full text-xs border border-rose-100 rounded-lg overflow-hidden">
                                    <thead className="bg-rose-50">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left font-semibold text-rose-800">Voce</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-rose-800 w-28">Pz. Unit. Lu.</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-rose-800 w-20">FTE</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-rose-800 w-28">Pz. Vend. Tot.</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-transparent border-separate" style={{ borderSpacing: "0 8px" }}>
                                      {group.items.length === 0 ? (
                                        <tr>
                                          <td colSpan={4} className="px-3 py-2 text-center text-slate-400 italic text-[10px]">
                                            Nessuna voce in questo raggruppamento
                                          </td>
                                        </tr>
                                      ) : group.items.map((item, iIdx) => (
                                        <tr key={item.id || iIdx} className="bg-white/70 backdrop-blur-md rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:bg-white/90 hover:-translate-y-0.5 transition-all border border-white/50 group">
                                          <td className="px-3 py-1.5 text-slate-700 rounded-l-xl">{item.label || '—'}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">{formatCurrency(item.lutech_unit_price ?? 0, 2)}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">{(item.fte ?? 0).toFixed(2)}</td>
                                          <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-800 rounded-r-xl">{formatCurrency(item.total, 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    {group.items.length > 0 && (
                                      <tfoot className="bg-rose-50 border-t border-rose-200">
                                        <tr>
                                          <td colSpan={3} className="px-3 py-1.5 text-right text-xs font-semibold text-rose-700">
                                            Totale {group.label}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-bold text-rose-800">
                                            {formatCurrency(group.items.reduce((s, it) => s + it.total, 0), 0)}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    )}
                                  </table>
                                </div>
                              ))}

                              {/* Voci senza raggruppamento */}
                              {(row.catalog_detail.ungrouped || []).length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-slate-500 mb-2">Voci senza raggruppamento</div>
                                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Voce</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-slate-600 w-28">Pz. Unit. Lu.</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-slate-600 w-20">FTE</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-slate-600 w-28">Pz. Vend. Tot.</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-transparent border-separate" style={{ borderSpacing: "0 8px" }}>
                                      {row.catalog_detail.ungrouped.map((item, iIdx) => (
                                        <tr key={item.id || iIdx} className="bg-white/70 backdrop-blur-md rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:bg-white/90 hover:-translate-y-0.5 transition-all border border-white/50 group">
                                          <td className="px-3 py-1.5 text-slate-700 rounded-l-xl">{item.label || '—'}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">{formatCurrency(item.lutech_unit_price ?? 0, 2)}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">{(item.fte ?? 0).toFixed(2)}</td>
                                          <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-800 rounded-r-xl">{formatCurrency(item.total, 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Summary totale catalogo */}
                              <div className="flex justify-end">
                                <div className="px-4 py-2 bg-rose-100 rounded-lg text-xs font-semibold text-rose-800">
                                  Totale Catalogo (quota Lutech): {formatCurrency(row.total_price, 0)}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {/* Riga Totale */}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-700">
                    TOTALE OFFERTA
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">-</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">
                    {formatCurrency(totalOffer)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
