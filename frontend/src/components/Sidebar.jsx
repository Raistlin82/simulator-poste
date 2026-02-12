import { useState, useEffect, useCallback } from 'react';
import { Sliders, Settings, X, FileSearch, Building2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';
import { useConfig } from '../features/config/context/ConfigContext';
import { useSimulation } from '../features/simulation/context/SimulationContext';

export default function Sidebar({
    onClose,
    onNavigate,
    currentView
}) {
    const { t } = useTranslation();

    // Get data from contexts (no more prop drilling!)
    const { config, updateConfig, setConfig } = useConfig();
    const {
        selectedLot,
        myDiscount,
        competitorDiscount,
        results,
        setLot,
        setDiscount
    } = useSimulation();

    // Local state for RTI quotas editing
    const [localQuotas, setLocalQuotas] = useState({});
    const [quotaError, setQuotaError] = useState(null);

    // Derived values
    const lotData = config && selectedLot ? config[selectedLot] : null;
    const isRti = lotData?.rti_enabled || false;
    const rtiCompanies = lotData?.rti_companies || [];
    const baseAmount = lotData?.base_amount || 0;
    const p_best = baseAmount * (1 - competitorDiscount / 100);
    const p_my = baseAmount * (1 - myDiscount / 100);
    const isBest = p_my < p_best;

    // Initialize local quotas from config when lot changes
    useEffect(() => {
        if (lotData?.rti_quotas && Object.keys(lotData.rti_quotas).length > 0) {
            setLocalQuotas(lotData.rti_quotas);
        } else if (isRti && rtiCompanies.length > 0) {
            // Initialize default quotas: Lutech 70%, rest split among partners
            const partnerCount = rtiCompanies.length;
            const remaining = 30.0;
            const perPartner = partnerCount > 0 ? Math.round((remaining / partnerCount) * 100) / 100 : 0;
            const defaultQuotas = { Lutech: 70.0 };
            rtiCompanies.forEach(company => {
                defaultQuotas[company] = perPartner;
            });
            setLocalQuotas(defaultQuotas);
        } else {
            setLocalQuotas({});
        }
    }, [selectedLot, lotData?.rti_quotas, isRti, rtiCompanies]);

    // Validate that quotas sum to 100
    const totalQuota = Object.values(localQuotas).reduce((sum, q) => sum + (parseFloat(q) || 0), 0);
    const isQuotaValid = Math.abs(totalQuota - 100) < 0.01;

    // Debounced save of quotas to backend
    const saveQuotas = useCallback(async (quotas) => {
        if (!lotData || !selectedLot) return;
        
        const total = Object.values(quotas).reduce((sum, q) => sum + (parseFloat(q) || 0), 0);
        if (Math.abs(total - 100) > 0.01) {
            setQuotaError(t('simulation.rti_total_must_100'));
            return;
        }
        setQuotaError(null);

        // Update local config immediately for responsive UI
        const updatedLot = { ...lotData, rti_quotas: quotas };
        const updatedConfig = { ...config, [selectedLot]: updatedLot };
        setConfig(updatedConfig);

        // Save to backend
        await updateConfig({ [selectedLot]: updatedLot });
    }, [lotData, selectedLot, config, setConfig, updateConfig, t]);

    // Handle quota change with debounce
    const handleQuotaChange = (company, value) => {
        const numValue = parseFloat(value) || 0;
        const newQuotas = { ...localQuotas, [company]: numValue };
        setLocalQuotas(newQuotas);
        
        // Debounce the save
        clearTimeout(window.quotaSaveTimeout);
        window.quotaSaveTimeout = setTimeout(() => {
            saveQuotas(newQuotas);
        }, 1000);
    };

    // Get all RTI companies including Lutech
    const allRtiCompanies = isRti ? ['Lutech', ...rtiCompanies] : [];

    return (
        <div className="w-[85vw] max-w-80 md:w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-20">
            {/* Lutech Logo Banner */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 flex justify-between items-center">
                <button
                    onClick={() => {
                        if (onNavigate) onNavigate('dashboard');
                        if (window.innerWidth < 768 && onClose) onClose();
                    }}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    aria-label="Vai alla Home"
                >
                    <img src="/logo-lutech.png" alt="Lutech" className="h-10 object-contain" />
                </button>
                {/* Close button - mobile only */}
                <button
                    onClick={onClose}
                    className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="Chiudi menu"
                >
                    <X className="w-5 h-5 text-slate-600" />
                </button>
            </div>

            <div className="p-6 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5 text-blue-600" />
                    <h2 className="font-semibold text-lg">{t('simulation.title')}</h2>
                </div>

                <label className="block text-sm font-medium text-slate-700 mb-1">{t('sidebar.title')}</label>
                <select
                    value={selectedLot || ''}
                    onChange={(e) => {
                        setLot(e.target.value);
                        // Close sidebar on mobile after selection
                        if (window.innerWidth < 768 && onClose) onClose();
                    }}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    {config && Object.keys(config).map(k => (
                        <option key={k} value={k}>{k}</option>
                    ))}
                </select>
                {config && selectedLot && config[selectedLot] && (
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500">{config[selectedLot].name}</p>
                        {config[selectedLot].rti_enabled && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-200">
                                <Building2 className="w-3 h-3" />
                                RTI ({(config[selectedLot].rti_companies?.length || 0) + 1})
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-8">

                {/* Economic Inputs */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('config.base_amount')}</label>
                        <div className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-slate-600 font-mono text-sm shadow-sm ring-1 ring-slate-100 italic">
                            {formatCurrency(baseAmount)}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-600 uppercase">{t('simulation.competitor_discount')}</label>
                            <div className="flex items-center gap-1 bg-white border rounded px-2 py-0.5">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={competitorDiscount}
                                    onChange={(e) => setDiscount('competitorDiscount', Math.round(parseFloat(e.target.value) * 10) / 10 || 0)}
                                    className="w-12 text-sm font-mono focus:outline-none text-right"
                                />
                                <span className="text-xs text-slate-400">%</span>
                            </div>
                        </div>
                        <input
                            type="range" min="0" max="100" step="0.1"
                            value={competitorDiscount}
                            onChange={(e) => setDiscount('competitorDiscount', parseFloat(e.target.value))}
                            className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500 touch-pan-x"
                            style={{ minHeight: '44px' }}
                        />
                        <p className="text-xs text-slate-400 mt-1 text-right">{t('simulation.best_price')}: {formatCurrency(p_best)}</p>
                    </div>

                    <div className={`p-4 rounded-lg border transition-colors ${isBest ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-600 uppercase">
                                {isRti ? t('simulation.my_discount_rti') : t('simulation.my_discount')}
                            </label>
                            <div className="flex items-center gap-1 bg-white border rounded px-2 py-0.5">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={myDiscount}
                                    onChange={(e) => setDiscount('myDiscount', Math.round(parseFloat(e.target.value) * 10) / 10 || 0)}
                                    className="w-12 text-sm font-mono focus:outline-none text-right text-blue-600 font-bold"
                                />
                                <span className="text-xs text-slate-400">%</span>
                            </div>
                        </div>
                        <input
                            type="range" min="0" max="100" step="0.1"
                            value={myDiscount}
                            onChange={(e) => setDiscount('myDiscount', parseFloat(e.target.value))}
                            className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 touch-pan-x"
                            style={{ minHeight: '44px' }}
                        />
                        <p className="text-xs text-slate-500 mt-1 text-right">{t('simulation.your_price')}: {formatCurrency(p_my)}</p>
                        {isBest && <p className="text-xs text-green-600 font-bold mt-2">{t('app.best_price_badge')}</p>}
                    </div>

                    {/* RTI Quota Breakdown */}
                    {isRti && allRtiCompanies.length > 0 && (
                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                            <div className="flex items-center gap-2 mb-3">
                                <Building2 className="w-4 h-4 text-indigo-600" />
                                <label className="text-xs font-bold text-indigo-700 uppercase">{t('simulation.rti_breakdown')}</label>
                            </div>
                            
                            {quotaError && (
                                <div className="flex items-center gap-2 mb-2 p-2 bg-red-100 rounded text-red-700 text-xs">
                                    <AlertCircle className="w-3 h-3" />
                                    {quotaError}
                                </div>
                            )}

                            <div className="space-y-2">
                                {allRtiCompanies.map(company => {
                                    const quota = parseFloat(localQuotas[company]) || 0;
                                    const amount = p_my * (quota / 100);
                                    return (
                                        <div key={company} className="flex items-center gap-2 bg-white rounded-md p-2 border border-indigo-100">
                                            <span className={`text-xs font-semibold flex-1 ${company === 'Lutech' ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {company}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    max="100"
                                                    value={quota}
                                                    onChange={(e) => handleQuotaChange(company, e.target.value)}
                                                    className="w-14 text-xs font-mono text-right border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                                />
                                                <span className="text-xs text-slate-400">%</span>
                                            </div>
                                            <span className="text-xs font-mono text-indigo-600 w-20 text-right">
                                                {formatCurrency(amount)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Total row */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-indigo-200">
                                <span className="text-xs font-bold text-indigo-700">{t('simulation.rti_total')}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold ${isQuotaValid ? 'text-green-600' : 'text-red-600'}`}>
                                        {totalQuota.toFixed(1)}%
                                    </span>
                                    <span className="text-xs font-mono font-bold text-indigo-700">
                                        {formatCurrency(p_my)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mini Summary */}
                {results && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="grid grid-cols-3 gap-3 text-center mb-6">
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{results.total_score}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">{t('dashboard.total')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-blue-600">{results.technical_score}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">{t('dashboard.technical')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-600">{results.economic_score}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">{t('dashboard.economic')}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section - Cert Verification */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
                <button
                    onClick={() => {
                        if (onNavigate) onNavigate('certs');
                        if (window.innerWidth < 768 && onClose) onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${
                        currentView === 'certs'
                            ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <FileSearch className="w-4 h-4" />
                    <span>Verifica Certificazioni</span>
                </button>
            </div>

            {/* Footer - Credits */}
            <div className="p-3 border-t border-slate-200 bg-white">
                <a
                    href="https://it.linkedin.com/in/gabrielerendina"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 hover:opacity-70 transition-opacity"
                >
                    <img src="/gr-logo.png" alt="GR" className="h-5 w-auto opacity-70" />
                    <span className="text-[10px] text-slate-400 font-medium">Gabriele Rendina 2026</span>
                </a>
            </div>
        </div>
    );
}
