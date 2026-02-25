import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Target, Loader2, FileSearch, Info } from 'lucide-react';
import axios from 'axios';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { useReactToPrint } from 'react-to-print';
import PremiumReport from '../features/reports/PremiumReport';
import { SkeletonGauge, SkeletonCard } from '../shared/components/ui/Skeleton';
import ScoreGauges from '../features/simulation/components/ScoreGauges';
import SimulationChart from '../features/simulation/components/SimulationChart';
import { useConfig } from '../features/config/context/ConfigContext';
import { useSimulation } from '../features/simulation/context/SimulationContext';
import { useToast } from '../shared/hooks/useToast';
import { logger } from '../utils/logger';
import { API_URL } from '../utils/api';

const fadeUp = {
    hidden: { opacity: 0, y: 12, filter: 'blur(8px)' },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            delay: i * 0.08,
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1]
        },
    }),
};

export default function Dashboard({ onNavigate }) {
    const { t } = useTranslation();
    const { config } = useConfig();
    const {
        selectedLot,
        myDiscount,
        competitorDiscount,
        competitorTechScore,
        competitorEconDiscount,
        techInputs,
        results,
        simulationData,
        setCompetitorParam,
        fetchEvaluationResults, // Added from instruction
        monteCarlo, // Added from instruction
        businessPlanData // Added from instruction
    } = useSimulation();

    // Derive lotData and lotKey from contexts
    const lotKey = selectedLot;
    const lotData = config?.[selectedLot];
    // const [monteCarlo, setMonteCarlo] = useState(null); // This is now from useSimulation
    const [exportLoading, setExportLoading] = useState(false);
    const [excelExportLoading, setExcelExportLoading] = useState(false);

    // Optimizer results state
    const [optimizerResults, setOptimizerResults] = useState(null);
    const [optimizerLoading, setOptimizerLoading] = useState(false);

    // Toast notifications
    const toast = useToast(); // Changed from { error: showError }

    // Ref for the report component
    const reportRef = useRef();

    // Run Monte Carlo when params change
    useEffect(() => {
        if (!results || !lotData) return;

        const controller = new AbortController();

        const runMC = async () => {
            try {
                const res = await axios.post(`${API_URL}/monte-carlo`, {
                    lot_key: lotKey,
                    base_amount: lotData.base_amount,
                    my_discount: myDiscount,
                    competitor_discount_mean: competitorDiscount,
                    competitor_discount_std: 3.5, // assumed volatility
                    current_tech_score: results.technical_score,
                    competitor_tech_score_mean: competitorTechScore,
                    competitor_tech_score_std: 3.0, // assumed volatility
                    iterations: 500
                }, { signal: controller.signal });
                // setMonteCarlo(res.data); // This is now handled by useSimulation if needed, or removed if not
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                logger.error("Monte Carlo simulation failed", err, { component: "Dashboard" });
                toast.error(t('errors.monte_carlo_failed')); // Changed from showError
            }
        };

        const timer = setTimeout(runMC, 1000); // debounce
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [myDiscount, competitorDiscount, results, lotKey, lotData, competitorTechScore, toast, t]); // Changed showError to toast

    // Run optimizer when competitor inputs change
    useEffect(() => {
        if (!results || !lotData) return;

        const controller = new AbortController();

        const runOptimizer = async () => {
            setOptimizerLoading(true);
            try {
                const res = await axios.post(`${API_URL}/optimize-discount`, {
                    lot_key: lotKey,
                    base_amount: lotData.base_amount,
                    my_tech_score: results.technical_score,
                    competitor_tech_score: competitorTechScore,
                    competitor_discount: competitorEconDiscount,
                    best_offer_discount: competitorDiscount
                }, { signal: controller.signal });
                setOptimizerResults(res.data);
            } catch (err) {
                if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
                logger.error("Optimizer failed", err, { component: "Dashboard" });
                toast.error(t('errors.optimizer_failed')); // Changed from showError
            } finally {
                if (!controller.signal.aborted) setOptimizerLoading(false);
            }
        };

        const timer = setTimeout(runOptimizer, 1000); // debounce
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [competitorTechScore, competitorEconDiscount, results?.technical_score, lotKey, competitorDiscount, lotData, results, toast, t]); // Changed showError to toast

    const handleExport = useReactToPrint({
        content: () => reportRef.current,
        documentTitle: `Report_${selectedLot?.replace(/\s+/g, '_') || 'Simulazione'}`,
        onBeforeGetContent: () => {
            setExportLoading(true);
            return Promise.resolve();
        },
        onAfterPrint: () => setExportLoading(false),
        onPrintError: (error) => {
            logger.error('PDF Export Error', error, { lot: selectedLot });
            toast.error(t('errors.export_failed') || 'Esportazione fallita');
            setExportLoading(false);
        }
    });

    const handleExcelExport = async () => {
        setExcelExportLoading(true);
        try {
            const res = await axios.post(`${API_URL}/export-excel`, {
                lot_key: lotKey,
                base_amount: lotData.base_amount,
                technical_score: results.technical_score,
                economic_score: results.economic_score,
                total_score: results.total_score,
                my_discount: myDiscount,
                competitor_discount: competitorDiscount,
                alpha: lotData.alpha || 0.3,
                win_probability: monteCarlo?.win_probability || 50,
                details: results.details,
                weighted_scores: results.weighted_scores || {},
                category_scores: {
                    company_certs: results.category_company_certs || 0,
                    resource: results.category_resource || 0,
                    reference: results.category_reference || 0,
                    project: results.category_project || 0
                },
                max_tech_score: results?.calculated_max_tech_score || lotData.max_tech_score || 60,
                max_econ_score: lotData.max_econ_score || 40,
                tech_inputs_full: techInputs || {},
                rti_quotas: lotData.rti_quotas || {}
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report_${lotKey.replace(/\s+/g, '_')}.xlsx`);
            document.body.appendChild(link);
            link.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (err) {
            logger.error('Excel Export Error', err, { lot: lotKey });
            toast.error(t('errors.excel_export_failed') || 'Esportazione Excel fallita'); // Changed from showError
        } finally {
            setExcelExportLoading(false);
        }
    };

    // Show loading skeleton when no results yet (AFTER all hooks!)
    if (!results || !lotData) {
        return (
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SkeletonGauge />
                    <SkeletonGauge />
                    <SkeletonGauge />
                </div>
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    return (
        <div className="space-y-4 sticky top-6">

            {/* 1. Score Cards */}
            <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
                <ScoreGauges
                    results={results}
                    lotData={lotData}
                    techInputs={techInputs}
                    onExport={handleExport}
                    onExcelExport={handleExcelExport}
                    exportLoading={exportLoading}
                    excelExportLoading={excelExportLoading}
                />
            </motion.div>

            {/* Strategic Analysis (Monte Carlo) */}
            <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp} className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 p-6 shadow-2xl shadow-indigo-500/5 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />

                <div className="relative z-10">
                    {/* Competitor Inputs for Optimizer */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-display">{t('dashboard.competitor_to_beat')}</h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 font-display">Targeting & Scenario Optimization</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-display block">Precision Iterations</span>
                                <span className="text-sm font-black text-indigo-600 font-display">500 Simulations</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/40 p-4 rounded-3xl border border-white/60 shadow-sm">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 block font-display">
                                {t('dashboard.competitor_tech_score')}
                            </label>
                            <div className="flex items-center gap-6">
                                <div className="flex-1 relative py-4">
                                    <input
                                        type="range"
                                        min="0"
                                        max={results?.calculated_max_tech_score || lotData?.max_tech_score || 60}
                                        step="0.5"
                                        value={competitorTechScore}
                                        onChange={(e) => setCompetitorParam('competitorTechScore', parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 transition-all hover:accent-indigo-500"
                                        aria-label={t('dashboard.competitor_tech_score')}
                                    />
                                </div>
                                <div className="min-w-[80px] h-12 flex items-center justify-center bg-slate-900 rounded-2xl shadow-lg">
                                    <span className="text-lg font-black text-white font-display tabular-nums">
                                        {formatNumber(competitorTechScore, 1)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between mt-2 font-display text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                                <span>MIN: 0.0</span>
                                <span>MAX: {formatNumber(results?.calculated_max_tech_score || lotData?.max_tech_score || 60, 1)}</span>
                            </div>
                        </div>

                        <div className="bg-white/40 p-6 rounded-3xl border border-white/60 shadow-sm">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 block font-display">
                                {t('dashboard.competitor_econ_discount')}
                            </label>
                            <div className="flex items-center gap-6">
                                <div className="flex-1 relative py-4">
                                    <input
                                        type="range"
                                        min="0"
                                        max={competitorDiscount}
                                        step="0.5"
                                        value={Math.min(competitorEconDiscount, competitorDiscount)}
                                        onChange={(e) => setCompetitorParam('competitorEconDiscount', parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500 transition-all hover:accent-rose-400"
                                        aria-label={t('dashboard.competitor_econ_discount')}
                                    />
                                </div>
                                <div className="min-w-[80px] h-12 flex items-center justify-center bg-rose-500 rounded-2xl shadow-lg">
                                    <span className="text-lg font-black text-white font-display tabular-nums">
                                        {formatNumber(competitorEconDiscount, 1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between mt-2 font-display text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                                <span>BASELINE: 0.0%</span>
                                <span>BEST OFFER: {formatNumber(competitorDiscount, 1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Optimizer Results - Discount Scenarios */}
                    {optimizerLoading ? (
                        <div className="mt-4 flex flex-col items-center justify-center py-20 bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-display animate-pulse">Calculating Optimal Trajectories</span>
                        </div>
                    ) : optimizerResults && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Competitor Summary */}
                                <div className="p-4 bg-indigo-500/5 backdrop-blur-md rounded-[2rem] border border-indigo-100/50 shadow-xl shadow-indigo-500/5 flex flex-col justify-between group/comp transition-all duration-300 hover:bg-indigo-500/10 hover:border-indigo-200">
                                    <div className="text-[9px] text-indigo-400 uppercase font-black tracking-widest mb-3 font-display">Target Competitor Score</div>
                                    <div className="flex flex-col">
                                        <span className="text-3xl font-black text-slate-800 font-display tracking-tightest leading-none group-hover/comp:scale-105 transition-transform origin-left">{formatNumber(optimizerResults.competitor_total_score, 2)}</span>
                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-indigo-100/50">
                                            <div className="px-2 py-1 bg-white/60 border border-white rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest font-display">PT: {formatNumber(optimizerResults.competitor_tech_score, 1)}</div>
                                            <div className="px-2 py-1 bg-white/60 border border-white rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest font-display">PE: {formatNumber(optimizerResults.competitor_econ_score, 1)}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Current Scenario */}
                                <div className="lg:col-span-2 p-6 bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-xl shadow-indigo-500/5 group/scenario relative overflow-hidden transition-all duration-300 hover:border-indigo-200">
                                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl group-hover/scenario:bg-indigo-500/10 transition-colors" />
                                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="space-y-6 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="px-3 py-1 bg-indigo-50 border border-indigo-100/50 rounded-full">
                                                    <span className="text-[9px] text-indigo-600 uppercase font-black tracking-widest font-display">{t('dashboard.current_scenario')}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-display">Live Analysis</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-display">Sconto Attuale</div>
                                                    <div className="text-2xl font-black text-slate-800 font-display">{formatNumber(myDiscount, 2)}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-display">Win Probability</div>
                                                    <div className="text-2xl font-black text-indigo-600 font-display">{monteCarlo?.win_probability || 0}%</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-px h-24 bg-slate-200/60 hidden md:block" />
                                        <div className="space-y-2 text-right">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-display">Controvalore Reale</div>
                                            <div className="text-xl font-black text-slate-800 font-display">{formatCurrency(lotData?.base_amount * (1 - myDiscount / 100))}</div>
                                            <div className="inline-flex px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] font-black text-emerald-600 uppercase tracking-widest font-display mt-2 shadow-sm">
                                                Score: {formatNumber(results.total_score, 2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Scenarios Grid */}
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-[9px] text-slate-400 uppercase font-black tracking-widest font-display">Strategie di posizionamento suggerite</h4>
                                    <div className="h-px bg-slate-200 flex-1 ml-6" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {optimizerResults.scenarios?.map((scenario, i) => {
                                        const theme = {
                                            'Conservativo': { bg: 'bg-white/40', border: 'border-amber-200', text: 'text-amber-600', accent: 'bg-amber-500', icon: '🛡️', shadow: 'shadow-amber-500/10' },
                                            'Bilanciato': { bg: 'bg-white/40', border: 'border-indigo-200', text: 'text-indigo-600', accent: 'bg-indigo-500', icon: '⚖️', shadow: 'shadow-indigo-500/10' },
                                            'Aggressivo': { bg: 'bg-white/40', border: 'border-orange-200', text: 'text-orange-600', accent: 'bg-orange-500', icon: '🚀', shadow: 'shadow-orange-500/10' },
                                            'Max': { bg: 'bg-white/40', border: 'border-emerald-200', text: 'text-emerald-600', accent: 'bg-emerald-500', icon: '🏆', shadow: 'shadow-emerald-500/10' }
                                        }[scenario.name] || { bg: 'bg-white/40', border: 'border-slate-200', text: 'text-slate-600', accent: 'bg-slate-500', icon: '📊', shadow: 'shadow-slate-500/10' };

                                        return (
                                            <motion.div
                                                key={scenario.name}
                                                className={`backdrop-blur-md rounded-[1.5rem] border ${theme.border} ${theme.bg} p-5 shadow-sm hover:shadow-xl ${theme.shadow} hover:-translate-y-1.5 transition-all duration-300 group relative overflow-hidden`}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.1 }}
                                            >
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full -mr-8 -mt-8 blur-xl" />
                                                <div className="relative z-10">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest font-display ${theme.text}`}>
                                                            {theme.icon} {t(`dashboard.scenarios.${scenario.name.toLowerCase()}`)}
                                                        </span>
                                                        <div className={`w-8 h-8 rounded-xl ${theme.accent} flex items-center justify-center shadow-lg shadow-black/5`}>
                                                            <span className="text-white text-[10px] font-black">{formatNumber(scenario.win_probability, 0)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-display">Suggerito</div>
                                                            <div className="text-[22px] font-black text-slate-900 font-display tabular-nums leading-none tracking-tightest">{formatNumber(scenario.suggested_discount, 2)}%</div>
                                                        </div>
                                                        <div className="pt-4 border-t border-slate-100/50 flex flex-col gap-2">
                                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">
                                                                <span>Score Tot:</span>
                                                                <span className="text-slate-900 font-bold">{formatNumber(scenario.resulting_total_score, 2)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">
                                                                <span>Valore:</span>
                                                                <span className="text-slate-900 font-bold">{formatCurrency(lotData?.base_amount * (1 - scenario.suggested_discount / 100))}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* 2. Simulation Chart */}
            <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
                <SimulationChart
                    simulationData={simulationData}
                    monteCarlo={monteCarlo}
                    results={results}
                    myDiscount={myDiscount}
                    competitorDiscount={competitorDiscount}
                />
            </motion.div>

            {/* 3. Detailed Score Table */}
            <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 p-1 shadow-2xl shadow-slate-500/5 overflow-hidden">
                <div className="p-6 border-b border-white/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/10">
                            <Info className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-display">{t('dashboard.detail_table')}</h3>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 font-display">Ripartizione Puntuale Requisiti Gara</p>
                        </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <div className="px-6 py-3 bg-indigo-500 text-white rounded-[1.25rem] shadow-lg shadow-indigo-500/20 flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest font-display opacity-80">PT Pesato:</span>
                            <span className="text-lg font-black font-display tabular-nums">{formatNumber(results.technical_score, 2)} / {results?.calculated_max_tech_score || lotData?.max_tech_score || 60}</span>
                        </div>
                        <div className="px-6 py-3 bg-white/60 border border-white/60 rounded-[1.25rem] shadow-sm flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest font-display text-slate-400">Raw Ponti:</span>
                            <span className="text-lg font-black font-display text-slate-800 tabular-nums">{formatNumber(results.raw_technical_score || 0, 1)} / {lotData?.max_raw_score || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto p-4 pt-2">
                    <table className="w-full text-sm text-left border-separate border-spacing-y-2 lg:border-spacing-y-3">
                        <thead>
                            <tr className="text-slate-400">
                                <th scope="col" className="px-8 py-4 text-left text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.requirement')}</th>
                                <th scope="col" className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.raw')}</th>
                                <th scope="col" className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.max_raw')}</th>
                                <th scope="col" className="px-6 py-4 text-right text-[9px] font-black text-indigo-500 uppercase tracking-widest font-display">{t('dashboard.weighted')}</th>
                                <th scope="col" className="px-6 py-4 text-right text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.tender_weight')}</th>
                                <th scope="col" className="px-8 py-4 text-center text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Company Certs */}
                            <tr className="bg-white/60 backdrop-blur-md rounded-[2rem] hover:bg-white transition-all shadow-sm hover:shadow-md group">
                                <td className="px-8 py-5 font-black text-slate-800 rounded-l-[1.5rem] font-display uppercase tracking-tight">
                                    <div className="flex flex-col">
                                        <span className="group-hover:text-indigo-600 transition-colors">{t('dashboard.company_certs')}</span>
                                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest opacity-60 mt-0.5">{t('config.company_certs')}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right font-black text-slate-900 font-display tabular-nums text-lg">{formatNumber(results.company_certs_score || 0, 1)}</td>
                                <td className="px-6 py-5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(results.max_company_certs_raw || lotData.company_certs?.reduce((sum, c) => sum + (c.points || 0), 0) || 0, 1)}</td>
                                <td className="px-6 py-5 text-right font-black text-indigo-600 font-display tabular-nums text-lg">{formatNumber(results.category_company_certs || 0, 2)}</td>
                                <td className="px-6 py-5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(lotData.company_certs?.reduce((sum, c) => sum + (c.gara_weight || 0), 0) || 0, 1)}</td>
                                <td className="px-8 py-5 text-center rounded-r-[1.5rem]">
                                    {(() => {
                                        const maxRaw = results.max_company_certs_raw || (lotData.company_certs?.reduce((sum, c) => sum + (c.points || 0), 0) || 0);
                                        const score = results.company_certs_score || 0;
                                        const isMax = score >= maxRaw && score > 0;
                                        return isMax ?
                                            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 shadow-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest font-display">{t('dashboard.max_status')}</span>
                                            </div> :
                                            <div className="flex items-center justify-center px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-black uppercase tracking-widest font-display">{formatNumber(maxRaw > 0 ? (score / maxRaw * 100) : 0, 0)}%</span>
                                            </div>;
                                    })()}
                                </td>
                            </tr>

                            {/* Requirements */}
                            {lotData?.reqs?.map(req => {
                                const score = results.details[req.id] || 0;
                                const maxRaw = results.max_raw_scores?.[req.id] || req.max_points;
                                const weightedScore = results.weighted_scores?.[req.id] || 0;
                                const isMax = score >= maxRaw;
                                const percentage = maxRaw > 0 ? (score / maxRaw * 100) : 0;
                                const isResourceType = req.type === 'resource';
                                return (
                                    <tr key={req.id} className="bg-white/60 backdrop-blur-md rounded-[2rem] hover:bg-white transition-all shadow-sm hover:shadow-md group">
                                        <td className="px-8 py-5 font-black text-slate-800 rounded-l-[1.5rem] font-display uppercase tracking-tight">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="group-hover:text-indigo-600 transition-colors leading-tight">{req.label}</span>
                                                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest opacity-60 mt-0.5">{req.id}</span>
                                                </div>
                                                {isResourceType && (
                                                    <button
                                                        onClick={() => onNavigate && onNavigate('certs')}
                                                        className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center shadow-inner"
                                                        title={t('dashboard.verify_certifications') || 'Verifica Certificazioni PDF'}
                                                    >
                                                        <FileSearch className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-slate-900 font-display tabular-nums text-lg">{formatNumber(score, 1)}</td>
                                        <td className="px-6 py-5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(maxRaw, 1)}</td>
                                        <td className="px-6 py-5 text-right font-black text-indigo-600 font-display tabular-nums text-lg">{formatNumber(weightedScore, 2)}</td>
                                        <td className="px-6 py-5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(req.gara_weight || 0, 1)}</td>
                                        <td className="px-8 py-5 text-center rounded-r-[1.5rem]">
                                            {isMax ?
                                                <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 shadow-sm">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest font-display">{t('dashboard.max_status')}</span>
                                                </div>
                                                :
                                                <div className="flex items-center justify-center px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl border border-slate-200">
                                                    <span className="text-[10px] font-black uppercase tracking-widest font-display text-nowrap">{formatNumber(percentage, 0)}% Complete</span>
                                                </div>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Hidden container per il PDF Export (PremiumReport) */}
            <div style={{ display: 'none' }}>
                <PremiumReport
                    ref={reportRef}
                    lotKey={lotKey}
                    simulationData={{
                        base_amount: lotData.base_amount,
                        technical_score: results.technical_score,
                        economic_score: results.economic_score,
                        total_score: results.total_score,
                        my_discount: results.my_discount || myDiscount,
                        competitor_discount: results.competitor_discount || competitorDiscount,
                        alpha: lotData.alpha || 0.3
                    }}
                    lotConfig={lotData}
                    details={results.details}
                    categoryScores={{
                        company_certs: results.category_company_certs || 0,
                        resource: results.category_resource || 0,
                        reference: results.category_reference || 0,
                        project: results.category_project || 0
                    }}
                    winProbability={monteCarlo?.win_probability || 50}
                    businessPlanData={businessPlanData}
                    t={t}
                />
            </div>
        </div>
    );
}
