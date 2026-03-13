import { useState, useMemo, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus, Trash2, GripVertical, Percent, Save, X, TrendingDown, Info, AlertTriangle, BookOpen, ChevronDown, ChevronUp, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

/**
 * TowConfigTable - Configurazione Type of Work
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
  profileMappings = {},
  profileRates = {},
  defaultDailyRate = 250,
  daysPerFte = 220,
  isRti = false,
  quotaLutech = 1.0,
}) {
  const { t } = useTranslation();
  const [showAddRow, setShowAddRow] = useState(false);
  const [expandedCatalog, setExpandedCatalog] = useState(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState(new Set());
  const [newTow, setNewTow] = useState({
    tow_id: '',
    label: '',
    type: 'task',
    weight_pct: 0,
    num_tasks: 0,
    duration_months: 0,
    activities: '',
    deliverables: '',
    lutech_pct: quotaLutech * 100
  });

  // Re-sync newTow default if quotaLutech changes
  useEffect(() => {
    setNewTow(prev => ({ ...prev, lutech_pct: quotaLutech * 100 }));
  }, [quotaLutech]);

  const towTypes = [
    { value: 'task', label: t('business_plan.tow_type_task', 'Task'), color: 'blue' },
    { value: 'corpo', label: t('business_plan.tow_type_corpo', 'A Corpo'), color: 'purple' },
    { value: 'consumo', label: t('business_plan.tow_type_consumo', 'A Consumo'), color: 'amber' },
    { value: 'canone', label: t('business_plan.tow_type_canone', 'Canone Mensile'), color: 'green' },
    { value: 'catalogo', label: t('business_plan.tow_type_catalogo', 'Catalogo'), color: 'rose' },
  ];

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
      deliverables: '',
      lutech_pct: quotaLutech * 100
    });
    setShowAddRow(false);
  };

  const handleUpdateTow = (index, field, value) => {
    const updated = tows.map((t, i) => {
      if (i !== index) return t;
      let processed = value;
      if (field === 'weight_pct' || field === 'lutech_pct') {
        processed = Math.min(100, Math.max(0, parseFloat(value) || 0));
      }
      return { ...t, [field]: processed };
    });
    onChange?.(updated);
  };

  const totalWeight = useMemo(() => tows.reduce((sum, t) => sum + (parseFloat(t.weight_pct) || 0), 0), [tows]);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;
  const weightedRtiQuota = useMemo(() => {
    return tows.reduce((sum, t) => {
      const weight = (parseFloat(t.weight_pct) || 0) / 100;
      const tLutech = (parseFloat(t.lutech_pct ?? (quotaLutech * 100))) / 100;
      return sum + (weight * tLutech);
    }, 0);
  }, [tows, quotaLutech]);

  const isRtiQuotaValid = !isRti || Math.abs(weightedRtiQuota - quotaLutech) < 0.001;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">ID TOW</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-center">Peso %</th>
              <th className="px-4 py-3 text-center">Lutech %</th>
              <th className="px-4 py-3 text-center w-20">Az.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tows.map((tow, idx) => (
              <tr key={tow.tow_id || idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 font-mono text-xs">{tow.tow_id}</td>
                <td className="px-4 py-2">{tow.label}</td>
                <td className="px-4 py-2">
                   <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100">
                     {tow.type}
                   </span>
                </td>
                <td className="px-4 py-2">
                  <input 
                    type="number" 
                    value={tow.weight_pct} 
                    onChange={(e) => handleUpdateTow(idx, 'weight_pct', e.target.value)}
                    className="w-16 px-1 py-1 border rounded text-center"
                  />
                </td>
                <td className="px-4 py-2">
                   <div className="flex items-center gap-1 justify-center">
                    <input 
                      type="number" 
                      value={tow.lutech_pct ?? (quotaLutech * 100)} 
                      onChange={(e) => handleUpdateTow(idx, 'lutech_pct', e.target.value)}
                      className="w-16 px-1 py-1 border rounded text-center"
                    />
                    {tow.lutech_pct !== undefined && Math.abs(tow.lutech_pct - (quotaLutech * 100)) > 0.01 && (
                      <button 
                        onClick={() => handleUpdateTow(idx, 'lutech_pct', quotaLutech * 100)}
                        className="p-1 text-slate-400 hover:text-indigo-600"
                        title="Reset al default globale"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                   </div>
                </td>
                <td className="px-4 py-2 text-center">
                   <button onClick={() => onChange?.(tows.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-red-600">
                     <Trash2 className="w-4 h-4" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/50 font-bold border-t border-slate-200">
             <tr>
               <td colSpan="3" className="px-4 py-3 text-right">Totale Peso:</td>
               <td className={`px-4 py-3 text-center ${!isWeightValid ? 'text-red-600' : 'text-emerald-600'}`}>
                 {totalWeight.toFixed(1)}%
               </td>
               <td className={`px-4 py-3 text-center ${!isRtiQuotaValid ? 'text-red-600' : 'text-emerald-600'}`}>
                 { (weightedRtiQuota * 100).toFixed(1) }% (Media)
                 {!isRtiQuotaValid && isRti && (
                   <div className="text-[10px] font-normal flex items-center justify-center gap-1 mt-1">
                     <AlertTriangle className="w-3 h-3" /> Target: {quotaLutech * 100}%
                   </div>
                 )}
               </td>
               <td></td>
             </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
