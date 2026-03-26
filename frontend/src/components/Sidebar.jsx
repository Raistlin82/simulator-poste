import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, X, FileSearch, Building2, AlertCircle, Briefcase, Home, Languages, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatters';
import { useConfig } from '../features/config/context/ConfigContext';
import { useSimulation } from '../features/simulation/context/SimulationContext';

export default function Sidebar({
    onClose,
    onNavigate,
    currentView
}) {
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'it' ? 'en' : 'it';
        i18n.changeLanguage(nextLang);
    };

    // Track lots where we've already saved default quotas
    const savedDefaultQuotasRef = useRef(new Set());

    // Ref for quota save timeout (avoids global window property)
    const quotaSaveTimeoutRef = useRef(null);

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

    // Local state
    const [localQuotas, setLocalQuotas] = useState({});
    const [quotaError, setQuotaError] = useState(null);
    const [showClosedTenders, setShowClosedTenders] = useState(() => {
        try {
            return localStorage.getItem('showClosedTenders') === 'true';
        } catch {
            return false;
        }
    });

    const toggleShowClosed = () => {
        const newValue = !showClosedTenders;
        setShowClosedTenders(newValue);
        try {
            localStorage.setItem('showClosedTenders', newValue.toString());
        } catch { /* noop */ }
    };

    // Derived values
    const lotData = config && selectedLot ? config[selectedLot] : null;
    const isRti = lotData?.rti_enabled || false;
    const rtiCompanies = lotData?.rti_companies || [];
    const baseAmount = lotData?.base_amount || 0;
    const p_best = baseAmount * (1 - competitorDiscount / 100);
    const p_my = baseAmount * (1 - myDiscount / 100);
    const isBest = p_my < p_best;

    // Keep a stable ref to updateConfig to avoid re-triggering the effect
    const updateConfigRef = useRef(updateConfig);
    useEffect(() => {
        updateConfigRef.current = updateConfig;
    }, [updateConfig]);

    // Stable ref for lotData to use inside effect without causing re-triggers
    const lotDataRef = useRef(lotData);
    useEffect(() => {
        lotDataRef.current = lotData;
    }, [lotData]);

    // Serialize rtiCompanies to a string for stable dependency comparison
    const rtiCompaniesKey = rtiCompanies.join(',');

    // Initialize local quotas from config when lot changes
    useEffect(() => {
        const currentLotData = lotDataRef.current;
        if (currentLotData?.rti_quotas && Object.keys(currentLotData.rti_quotas).length > 0) {
            setLocalQuotas(currentLotData.rti_quotas);
        } else if (isRti && rtiCompaniesKey) {
            // Initialize default quotas: Lutech 70%, rest split among partners
            const companies = rtiCompaniesKey.split(',');
            const partnerCount = companies.length;
            const remaining = 30.0;
            const perPartner = partnerCount > 0 ? Math.round((remaining / partnerCount) * 100) / 100 : 0;
            const defaultQuotas = { Lutech: 70.0 };
            companies.forEach(company => {
                defaultQuotas[company] = perPartner;
            });
            setLocalQuotas(defaultQuotas);

            // Auto-save default quotas to backend so they're available for export
            // Only save once per lot to avoid loops
            if (currentLotData && selectedLot && !savedDefaultQuotasRef.current.has(selectedLot)) {
                savedDefaultQuotasRef.current.add(selectedLot);
                const updatedLot = { ...currentLotData, rti_quotas: defaultQuotas };
                updateConfigRef.current({ [selectedLot]: updatedLot });
            }
        } else {
            setLocalQuotas({});
        }
    }, [selectedLot, isRti, rtiCompaniesKey]);

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

        // Debounce the save using ref instead of global
        if (quotaSaveTimeoutRef.current) {
            clearTimeout(quotaSaveTimeoutRef.current);
        }
        quotaSaveTimeoutRef.current = setTimeout(() => {
            saveQuotas(newQuotas);
        }, 1000);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (quotaSaveTimeoutRef.current) {
                clearTimeout(quotaSaveTimeoutRef.current);
            }
        };
    }, []);

    // Get all RTI companies including Lutech
    const allRtiCompanies = isRti ? ['Lutech', ...rtiCompanies] : [];

    return (
        <div className="w-[85vw] max-w-80 md:w-80 bg-white/40 backdrop-blur-2xl border-r border-white/60 flex flex-col h-full shadow-2xl z-20 overflow-hidden">
            <div className="p-6 bg-white/60 backdrop-blur-xl border-b border-white/60 flex justify-between items-center group/logo">
                <button
                    onClick={() => {
                        if (onNavigate) onNavigate('dashboard');
                        if (window.innerWidth < 768 && onClose) onClose();
                    }}
                    className="hover:scale-105 transition-transform cursor-pointer p-1"
                    aria-label={t('sidebar.home_aria')}
                >
                    <img src="/logo-lutech.png" alt="Lutech" className="h-10 object-contain drop-shadow-sm" />
                </button>
                {/* Close button - mobile only */}
                <button
                    onClick={onClose}
                    className="md:hidden p-3 bg-white/60 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all border border-white/60 shadow-sm"
                    aria-label={t('sidebar.close_menu_aria')}
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-6 border-b border-white/60 bg-white/30 backdrop-blur-md">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover/logo:-rotate-3 transition-transform">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-0.5">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display leading-tight">{t('simulation.title')}</h2>
                            <button
                                onClick={toggleShowClosed}
                                className={`p-1 rounded-md transition-colors ${showClosedTenders ? 'text-indigo-600 bg-indigo-50 shadow-sm' : 'text-slate-300 hover:text-slate-400 hover:bg-slate-50'}`}
                                title={showClosedTenders ? t('sidebar.hide_closed') : t('sidebar.show_closed')}
                            >
                                <Filter className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest font-display">{selectedLot || t('sidebar.no_lots')}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest-plus ml-1 font-display opacity-60">{t('sidebar.title')}</label>
                    <div className="relative group/select">
                        <select
                            value={selectedLot || ''}
                            onChange={(e) => {
                                setLot(e.target.value);
                                if (window.innerWidth < 768 && onClose) onClose();
                            }}
                            className="w-full p-3.5 pl-4 pr-10 border border-white/60 rounded-2xl bg-white/60 backdrop-blur-md focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-xs transition-all shadow-sm shadow-indigo-500/5 appearance-none cursor-pointer font-display text-slate-800"
                        >
                            {config && Object.keys(config)
                                .filter(k => showClosedTenders || config[k]?.is_active !== false)
                                .sort((a, b) => a.localeCompare(b, 'it'))
                                .map(k => (
                                    <option key={k} value={k}>
                                        {k}
                                    </option>
                                ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover/select:text-indigo-500 transition-colors">
                            <Settings className="w-4 h-4" />
                        </div>
                    </div>
                </div>
                {config && selectedLot && config[selectedLot] && (
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                        <p className="text-[10px] font-bold text-slate-500 leading-tight flex-1">{config[selectedLot].name}</p>
                        {config[selectedLot].rti_enabled && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 text-[9px] font-black rounded-lg border border-indigo-100/50 shadow-sm font-display uppercase tracking-widest">
                                <Building2 className="w-3 h-3" />
                                RTI ({(config[selectedLot].rti_companies?.length || 0) + 1})
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">

                {/* Economic Inputs */}
                <div className="space-y-4">
                    {/* Base Amount - compact */}
                    <div className="p-6 bg-white/60 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 group/base">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover/base:rotate-6 transition-transform">
                                <Briefcase className="w-4 h-4 text-slate-500" />
                            </div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display">{t('config.base_amount')}</label>
                        </div>
                        <div className="text-xl font-black text-slate-800 font-display tracking-tight leading-none">{formatCurrency(baseAmount)}</div>
                    </div>

                    {/* Discount inputs - unified compact style */}
                    <div className="rounded-[2.5rem] border border-white/60 bg-white/40 backdrop-blur-xl overflow-hidden shadow-2xl shadow-indigo-500/5">
                        {/* Best Offer row */}
                        <div className="relative group/comp">
                            <div
                                className="absolute inset-y-0 left-0 bg-orange-50/50 transition-all duration-700"
                                style={{ width: `${Math.min(competitorDiscount, 100)}%` }}
                            />
                            <div className="relative px-6 py-5 flex items-center gap-4 border-b border-white/60">
                                <div className="w-1.5 h-10 rounded-full bg-orange-500 shadow-lg shadow-orange-500/20 group-hover/comp:scale-y-110 transition-transform" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight font-display mb-1">{t('simulation.competitor_discount')}</div>
                                    <div className="text-xs text-slate-500 font-black tracking-tight font-display">{formatCurrency(p_best)}</div>
                                </div>
                                <div className="flex items-center bg-white/80 border border-orange-200/50 rounded-xl shadow-sm overflow-hidden focus-within:ring-4 focus-within:ring-orange-500/10 transition-all">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={competitorDiscount.toFixed(1)}
                                        onChange={(e) => setDiscount('competitorDiscount', Math.round(parseFloat(e.target.value) * 10) / 10 || 0)}
                                        className="w-14 text-xs font-black text-orange-700 text-right px-2 py-2.5 bg-transparent focus:outline-none font-display"
                                    />
                                    <span className="text-[10px] font-black text-orange-400 pr-3 bg-orange-50/50 py-2.5 font-display">%</span>
                                </div>
                            </div>
                        </div>

                        {/* My Discount row */}
                        <div className="relative group/my">
                            <div
                                className={`absolute inset-y-0 left-0 ${isBest ? 'bg-emerald-50/50' : 'bg-indigo-50/50'} transition-all duration-700`}
                                style={{ width: `${Math.min(myDiscount, 100)}%` }}
                            />
                            <div className="relative px-6 py-5 flex items-center gap-4">
                                <div className={`w-1.5 h-10 rounded-full ${isBest ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-indigo-500 shadow-lg shadow-indigo-500/20'} group-hover/my:scale-y-110 transition-transform`} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight font-display mb-1">
                                        {isRti ? t('simulation.my_discount_rti') : t('simulation.my_discount')}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`text-xs ${isBest ? 'text-emerald-700' : 'text-indigo-700'} font-black tracking-tight font-display`}>{formatCurrency(p_my)}</div>
                                        {isBest && <span className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded-full shadow-lg shadow-emerald-500/20 animate-pulse uppercase tracking-widest font-display">Best</span>}
                                    </div>
                                </div>
                                <div className={`flex items-center bg-white/80 border rounded-xl shadow-sm overflow-hidden transition-all focus-within:ring-4 ${isBest ? 'border-emerald-200 focus-within:ring-emerald-500/10' : 'border-indigo-200 focus-within:ring-indigo-500/10'}`}>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={myDiscount.toFixed(1)}
                                        onChange={(e) => setDiscount('myDiscount', Math.round(parseFloat(e.target.value) * 10) / 10 || 0)}
                                        className={`w-14 text-xs font-black text-right px-2 py-2.5 bg-transparent focus:outline-none font-display ${isBest ? 'text-emerald-700' : 'text-indigo-700'}`}
                                    />
                                    <span className={`text-[10px] font-black ${isBest ? 'text-emerald-400 bg-emerald-50/50' : 'text-indigo-400 bg-indigo-50/50'} pr-3 py-2.5 font-display`}>%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* RTI Quota Breakdown */}
                {isRti && allRtiCompanies.length > 0 && (
                    <div className="rounded-[2.5rem] border border-white/60 bg-white/40 backdrop-blur-xl overflow-hidden shadow-2xl shadow-indigo-500/5">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-6 py-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20">
                                        <Building2 className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest font-display">{t('simulation.rti_breakdown')}</span>
                                </div>
                            </div>
                        </div>

                        {quotaError && (
                            <div className="flex items-center gap-3 px-6 py-3 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest font-display">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {quotaError}
                            </div>
                        )}

                        {/* Company rows */}
                        <div className="flex flex-col gap-2 p-3 bg-white/20">
                            {allRtiCompanies.map((company) => {
                                const quota = parseFloat(localQuotas[company]) || 0;
                                const amount = p_my * (quota / 100);
                                const isLutech = company === 'Lutech';
                                const indicatorColor = isLutech ? 'bg-indigo-500' : 'bg-purple-400';

                                return (
                                    <div key={company} className="relative group bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-500 overflow-hidden">
                                        {/* Background progress bar */}
                                        <div
                                            className={`absolute inset-y-0 left-0 ${isLutech ? 'bg-indigo-500/10' : 'bg-purple-500/10'} transition-all duration-700`}
                                            style={{ width: `${Math.min(quota, 100)}%` }}
                                        />

                                        <div className="relative px-4 py-3.5 flex items-center gap-3">
                                            {/* Company indicator */}
                                            <div className={`w-1 h-8 rounded-full ${indicatorColor} group-hover:scale-y-110 transition-transform`} />

                                            {/* Company name */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] font-black text-slate-800 uppercase tracking-tight font-display truncate">
                                                    {company}
                                                </div>
                                                <div className="text-[10px] font-black text-indigo-500/70 font-display">
                                                    {formatCurrency(amount)}
                                                </div>
                                            </div>

                                            {/* Quota input */}
                                            <div className="flex items-center bg-white/80 border border-indigo-100 rounded-xl shadow-sm overflow-hidden focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    value={quota.toFixed(1)}
                                                    onChange={(e) => handleQuotaChange(company, e.target.value)}
                                                    className="w-12 text-[10px] font-black text-indigo-700 text-right px-2 py-2 bg-transparent focus:outline-none font-display"
                                                />
                                                <span className="text-[9px] font-black text-indigo-300 pr-2.5 bg-indigo-50/50 py-2 font-display">%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer with total */}
                        <div className="bg-white/40 px-6 py-4 border-t border-white/60">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-display">{t('simulation.rti_total')}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-black font-display ${isQuotaValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {totalQuota.toFixed(1)}%
                                    </span>
                                    {!isQuotaValid && (
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-lg shadow-rose-500/50" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mini Summary */}
                {results && (
                    <div className="mt-8 pt-6 border-t border-white/20">
                        <div className="grid grid-cols-3 gap-3 text-center mb-6">
                            <div className="bg-white/30 p-2 rounded-xl border border-white/20 backdrop-blur-sm">
                                <div className="text-2xl font-black text-slate-800 font-display tracking-tightest">{results.total_score}</div>
                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest-plus">{t('dashboard.total')}</div>
                            </div>
                            <div className="bg-blue-50/40 p-2 rounded-xl border border-blue-200/30 backdrop-blur-sm">
                                <div className="text-2xl font-black text-blue-600 font-display tracking-tightest">{results.technical_score}</div>
                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest-plus">{t('dashboard.technical')}</div>
                            </div>
                            <div className="bg-green-50/40 p-2 rounded-xl border border-green-200/30 backdrop-blur-sm">
                                <div className="text-2xl font-black text-green-600 font-display tracking-tightest">{results.economic_score}</div>
                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest-plus">{t('dashboard.economic')}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section - Business Plan & Cert Verification */}
            <div className="p-4 border-t border-white/60 bg-white/20 space-y-3">
                <button
                    onClick={() => {
                        if (onNavigate) onNavigate('dashboard');
                        if (window.innerWidth < 768 && onClose) onClose();
                    }}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest-plus font-display shadow-lg ${currentView === 'dashboard'
                        ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow-xl -translate-y-0.5'
                        : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600 border border-transparent hover:border-indigo-100 shadow-none'
                        }`}
                >
                    <Home className={`w-4 h-4 ${currentView === 'dashboard' ? 'text-white' : 'text-indigo-400'}`} />
                    <span>{t('common.home')}</span>
                </button>
                <button
                    onClick={() => {
                        if (onNavigate) onNavigate('businessPlan');
                        if (window.innerWidth < 768 && onClose) onClose();
                    }}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest-plus font-display shadow-lg ${currentView === 'businessPlan'
                        ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow-xl -translate-y-0.5'
                        : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600 border border-transparent hover:border-indigo-100 shadow-none'
                        }`}
                >
                    <Briefcase className={`w-4 h-4 ${currentView === 'businessPlan' ? 'text-white' : 'text-indigo-400'}`} />
                    <span>{t('business_plan.title')}</span>
                </button>
                <button
                    onClick={() => {
                        if (onNavigate) onNavigate('certs');
                        if (window.innerWidth < 768 && onClose) onClose();
                    }}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest-plus font-display shadow-lg ${currentView === 'certs'
                        ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow-xl -translate-y-0.5'
                        : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600 border border-transparent hover:border-indigo-100 shadow-none'
                        }`}
                >
                    <FileSearch className={`w-4 h-4 ${currentView === 'certs' ? 'text-white' : 'text-indigo-400'}`} />
                    <span>{t('cert_verification.title')}</span>
                </button>

                <div className="pt-2 border-t border-white/40">
                    {/* Language Switcher */}
                    <button
                        onClick={toggleLanguage}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest-plus hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all border border-transparent hover:border-indigo-100"
                        title={t('sidebar.switch_lang')}
                    >
                        <div className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-md">
                            <Languages className="w-3 h-3" />
                        </div>
                        <span className="truncate">{i18n.language === 'it' ? 'English' : 'Italiano'}</span>
                    </button>
                </div>
            </div>

            {/* Footer - Credits */}
            <div className="p-3 border-t border-white/60 bg-white/40">
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
