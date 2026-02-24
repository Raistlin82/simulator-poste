import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Target, Loader2 } from 'lucide-react';
import axios from 'axios';
import { formatCurrency, formatNumber } from '../../../utils/formatters';
import { useSimulation } from '../context/SimulationContext';
import { useConfig } from '../../config/context/ConfigContext';
import { API_URL } from '../../../utils/api';
import { logger } from '../../../utils/logger';

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

export default function CompetitorAnalysis() {
    const { t } = useTranslation();
    const { config } = useConfig();
    const {
        selectedLot,
        myDiscount,
        competitorDiscount,
        competitorTechScore,
        competitorEconDiscount,
        results,
        setCompetitorParam,
        monteCarlo
    } = useSimulation();

    const lotData = config?.[selectedLot];
    const lotKey = selectedLot;

    const [optimizerResults, setOptimizerResults] = useState(null);
    const [optimizerLoading, setOptimizerLoading] = useState(false);

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
                logger.error("Optimizer failed", err, { component: "CompetitorAnalysis" });
            } finally {
                if (!controller.signal.aborted) setOptimizerLoading(false);
            }
        };

        const timer = setTimeout(runOptimizer, 1000);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [competitorTechScore, competitorEconDiscount, results?.technical_score, lotKey, competitorDiscount, lotData, results]);

    if (!results || !lotData) return null;

    return (
        <div className="space-y-6">
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 p-8 shadow-2xl shadow-indigo-500/5 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-display">{t('dashboard.competitor_to_beat')}</h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 font-display">Targeting & Scenario Optimization</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 mb-10">
                        <div className="bg-white/40 p-6 rounded-3xl border border-white/60 shadow-sm">
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
                                    />
                                </div>
                                <div className="min-w-[80px] h-12 flex items-center justify-center bg-slate-900 rounded-2xl shadow-lg">
                                    <span className="text-lg font-black text-white font-display tabular-nums">
                                        {formatNumber(competitorTechScore, 1)}
                                    </span>
                                </div>
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
                                    />
                                </div>
                                <div className="min-w-[80px] h-12 flex items-center justify-center bg-rose-500 rounded-2xl shadow-lg">
                                    <span className="text-lg font-black text-white font-display tabular-nums">
                                        {formatNumber(competitorEconDiscount, 1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {optimizerLoading ? (
                        <div className="mt-4 flex flex-col items-center justify-center py-20 bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-display animate-pulse">Calculating Optimal Trajectories</span>
                        </div>
                    ) : optimizerResults && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 gap-6">
                                {/* Competitor Summary */}
                                <div className="p-6 bg-indigo-500/5 backdrop-blur-md rounded-[2rem] border border-indigo-100/50 shadow-xl shadow-indigo-500/5 flex flex-col justify-between group/comp transition-all duration-300 hover:bg-indigo-500/10 hover:border-indigo-200">
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
                                <div className="p-8 bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-xl shadow-indigo-500/5 group/scenario relative overflow-hidden transition-all duration-300 hover:border-indigo-200">
                                    <div className="relative z-10 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 bg-indigo-50 border border-indigo-100/50 rounded-full">
                                                <span className="text-[9px] text-indigo-600 uppercase font-black tracking-widest font-display">{t('dashboard.current_scenario')}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-display">Sconto</div>
                                                <div className="text-xl font-black text-slate-800 font-display">{formatNumber(myDiscount, 2)}%</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-display">Win Prob.</div>
                                                <div className="text-xl font-black text-indigo-600 font-display">{monteCarlo?.win_probability || 0}%</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Scenarios Grid */}
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-[9px] text-slate-400 uppercase font-black tracking-widest font-display">Strategie</h4>
                                    <div className="h-px bg-slate-200 flex-1 ml-6" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {optimizerResults.scenarios?.map((scenario, i) => {
                                        const theme = {
                                            'Conservativo': { bg: 'bg-white/40', border: 'border-amber-200', text: 'text-amber-600', accent: 'bg-amber-500', icon: '🛡️' },
                                            'Bilanciato': { bg: 'bg-white/40', border: 'border-indigo-200', text: 'text-indigo-600', accent: 'bg-indigo-500', icon: '⚖️' },
                                            'Aggressivo': { bg: 'bg-white/40', border: 'border-orange-200', text: 'text-orange-600', accent: 'bg-orange-500', icon: '🚀' },
                                            'Max': { bg: 'bg-white/40', border: 'border-emerald-200', text: 'text-emerald-600', accent: 'bg-emerald-500', icon: '🏆' }
                                        }[scenario.name] || { bg: 'bg-white/40', border: 'border-slate-200', text: 'text-slate-600', accent: 'bg-slate-500', icon: '📊' };

                                        return (
                                            <div key={scenario.name} className={`backdrop-blur-md rounded-2xl border ${theme.border} ${theme.bg} p-4 shadow-sm transition-all duration-300`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest font-display ${theme.text}`}>
                                                        {theme.icon} {scenario.name}
                                                    </span>
                                                    <span className={`text-[9px] font-black ${theme.text}`}>{formatNumber(scenario.win_probability, 0)}%</span>
                                                </div>
                                                <div className="text-lg font-black text-slate-900 font-display tabular-nums tracking-tightest">{formatNumber(scenario.suggested_discount, 2)}%</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
