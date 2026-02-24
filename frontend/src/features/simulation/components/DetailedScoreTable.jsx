import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info, FileSearch } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatNumber } from '../../../utils/formatters';

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

export default function DetailedScoreTable({ results, lotData, onNavigate }) {
    const { t } = useTranslation();

    if (!results || !lotData) return null;

    return (
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
                    <div className="px-6 py-2.5 bg-indigo-500 text-white rounded-[1.25rem] shadow-lg shadow-indigo-500/20 flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest font-display opacity-80">PT Pesato:</span>
                        <span className="text-lg font-black font-display tabular-nums">{formatNumber(results.technical_score, 2)} / {results?.calculated_max_tech_score || lotData?.max_tech_score || 60}</span>
                    </div>
                    <div className="px-6 py-2.5 bg-white/60 border border-white/60 rounded-[1.25rem] shadow-sm flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest font-display text-slate-400">Raw Ponti:</span>
                        <span className="text-lg font-black font-display text-slate-800 tabular-nums">{formatNumber(results.raw_technical_score || 0, 1)} / {lotData?.max_raw_score || 0}</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto p-4 pt-2">
                <table className="w-full text-sm text-left border-separate border-spacing-y-1 lg:border-spacing-y-1.5">
                    <thead>
                        <tr className="text-slate-400">
                            <th scope="col" className="px-8 py-2.5 text-left text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.requirement')}</th>
                            <th scope="col" className="px-6 py-2.5 text-right text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.raw')}</th>
                            <th scope="col" className="px-6 py-2.5 text-right text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.max_raw')}</th>
                            <th scope="col" className="px-6 py-2.5 text-right text-[9px] font-black text-indigo-500 uppercase tracking-widest font-display">{t('dashboard.weighted')}</th>
                            <th scope="col" className="px-6 py-2.5 text-right text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.tender_weight')}</th>
                            <th scope="col" className="px-8 py-2.5 text-center text-[9px] font-black uppercase tracking-widest font-display">{t('dashboard.status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Company Certs */}
                        <tr className="bg-white/60 backdrop-blur-md rounded-[2rem] hover:bg-white transition-all shadow-sm hover:shadow-md group">
                            <td className="px-8 py-2.5 font-black text-slate-800 rounded-l-[1.5rem] font-display uppercase tracking-tight">
                                <div className="flex flex-col">
                                    <span className="group-hover:text-indigo-600 transition-colors">{t('dashboard.company_certs')}</span>
                                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest opacity-60 mt-0.5">{t('config.company_certs')}</span>
                                </div>
                            </td>
                            <td className="px-6 py-2.5 text-right font-black text-slate-900 font-display tabular-nums text-lg">{formatNumber(results.company_certs_score || 0, 1)}</td>
                            <td className="px-6 py-2.5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(results.max_company_certs_raw || lotData.company_certs?.reduce((sum, c) => sum + (c.points || 0), 0) || 0, 1)}</td>
                            <td className="px-6 py-2.5 text-right font-black text-indigo-600 font-display tabular-nums text-lg">{formatNumber(results.category_company_certs || 0, 2)}</td>
                            <td className="px-6 py-2.5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(lotData.company_certs?.reduce((sum, c) => sum + (c.gara_weight || 0), 0) || 0, 1)}</td>
                            <td className="px-8 py-2.5 text-center rounded-r-[1.5rem]">
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
                                    <td className="px-8 py-2.5 font-black text-slate-800 rounded-l-[1.5rem] font-display uppercase tracking-tight">
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
                                    <td className="px-6 py-2.5 text-right font-black text-slate-900 font-display tabular-nums text-lg">{formatNumber(score, 1)}</td>
                                    <td className="px-6 py-2.5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(maxRaw, 1)}</td>
                                    <td className="px-6 py-2.5 text-right font-black text-indigo-600 font-display tabular-nums text-lg">{formatNumber(weightedScore, 2)}</td>
                                    <td className="px-6 py-2.5 text-right text-slate-400 font-bold font-display tabular-nums">{formatNumber(req.gara_weight || 0, 1)}</td>
                                    <td className="px-8 py-2.5 text-center rounded-r-[1.5rem]">
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
    );
}
