import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, Info, ChevronDown, ChevronUp, Plus, Minus, ClipboardCheck, BarChart3, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/formatters';
import { useReactToPrint } from 'react-to-print';
import PremiumReport from '../features/reports/PremiumReport';
import { useConfig } from '../features/config/context/ConfigContext';
import { useSimulation } from '../features/simulation/context/SimulationContext';
import ConfigPage from './ConfigPage';
import axios from 'axios';
import { API_URL } from '../utils/api';
import { logger } from '../utils/logger';
import { useToast } from '../shared/hooks/useToast';
import ScoreGauges from '../features/simulation/components/ScoreGauges';
import SimulationChart from '../features/simulation/components/SimulationChart';
import DetailedScoreTable from '../features/simulation/components/DetailedScoreTable';
import CompetitorAnalysis from '../features/simulation/components/CompetitorAnalysis';
import React, { useRef } from 'react';

export default function TechEvaluator({ onNavigate }) {
    const { t } = useTranslation();
    const { config } = useConfig();
    const [activeTab, setActiveTab] = useState('valutazione'); // 'valutazione' | 'configurazione' | 'analisi'
    const reportRef = useRef();
    const {
        selectedLot,
        techInputs: inputs,
        companyCerts: certs,
        results,
        setTechInput,
        setCompanyCert,
        simulationData,
        monteCarlo,
        myDiscount,
        competitorDiscount
    } = useSimulation();

    const toast = useToast();
    const [exportLoading, setExportLoading] = useState(false);
    const [excelExportLoading, setExcelExportLoading] = useState(false);

    const handleExport = useReactToPrint({
        contentRef: reportRef,
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
                lot_key: selectedLot,
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
                tech_inputs_full: inputs || {},
                rti_quotas: lotData.rti_quotas || {}
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report_${selectedLot.replace(/\s+/g, '_')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (err) {
            logger.error('Excel Export Error', err, { lot: selectedLot });
            toast.error(t('errors.excel_export_failed') || 'Esportazione Excel fallita');
        } finally {
            setExcelExportLoading(false);
        }
    };

    // Derive lotData from context
    const lotData = config?.[selectedLot];
    const [expandedSections, setExpandedSections] = useState({
        companyCerts: true,
        profCerts: true,
        projectRefs: true
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };
    const QUAL_OPTIONS = [
        t('tech.qual_options.absent'),
        t('tech.qual_options.partial'),
        t('tech.qual_options.adequate'),
        t('tech.qual_options.good'),
        t('tech.qual_options.excellent'),
        t('tech.qual_options.outstanding')
    ];

    const updateInput = (reqId, field, value) => {
        const currentInput = inputs[reqId] || {};
        setTechInput(reqId, {
            ...currentInput,
            [field]: value
        });
    };

    const setCertStatus = (label, status) => {
        setCompanyCert(label, status);  // "all", "partial", "none"
    };

    // Memoize heavy array operations — must be before any early returns (Rules of Hooks)
    const maxCompanyCerts = useMemo(
        () => results?.max_company_certs_raw ?? (lotData?.company_certs?.reduce((sum, c) => sum + (c.points || 0), 0) || 0),
        [lotData, results?.max_company_certs_raw]
    );
    const maxProfCerts = useMemo(
        () => lotData?.reqs?.filter(r => r.type === 'resource').reduce((sum, r) =>
            sum + (results?.max_raw_scores?.[r.id] ?? r.max_points ?? 0), 0) || 0,
        [lotData, results?.max_raw_scores]
    );
    const maxProjectRefs = useMemo(
        () => lotData?.reqs?.filter(r => ['reference', 'project'].includes(r.type)).reduce((sum, r) =>
            sum + (results?.max_raw_scores?.[r.id] ?? r.max_points ?? 0), 0) || 0,
        [lotData, results?.max_raw_scores]
    );
    const rawProfCerts = useMemo(
        () => lotData?.reqs?.filter(r => r.type === 'resource').reduce((sum, req) =>
            sum + (results?.details?.[req.id] || 0), 0) || 0,
        [lotData, results?.details]
    );
    const weightedProjectRefs = useMemo(
        () => lotData?.reqs?.filter(r => ['reference', 'project'].includes(r.type)).reduce((sum, r) =>
            sum + (results?.details?.[r.id] || 0), 0) || 0,
        [lotData, results?.details]
    );
    const rawProjectRefs = useMemo(
        () => lotData?.reqs?.filter(r => ['reference', 'project'].includes(r.type)).reduce((sum, req) => {
            const cur = inputs[req.id] || { sub_req_vals: [], bonus_active: false, attestazione_active: false, custom_metric_vals: {} };
            const subSum = cur.sub_req_vals?.reduce((subSum, sv) => {
                const sub = (req.sub_reqs || req.criteria || []).find(s => s.id === sv.sub_id);
                const weight = sub?.weight || 1;
                return subSum + ((sv.val || 0) * weight);
            }, 0) || 0;
            const attSum = cur.attestazione_active ? (req.attestazione_score || 0) : 0;
            const customSum = Object.entries(cur.custom_metric_vals || {}).reduce((cSum, [, mVal]) =>
                cSum + (parseFloat(mVal) || 0), 0);
            const bonusSum = cur.bonus_active ? (req.bonus_val || 0) : 0;
            const maxRaw = req.max_points || 0;
            return sum + Math.min(subSum + attSum + customSum + bonusSum, maxRaw);
        }, 0) || 0,
        [lotData, inputs]
    );

    // Guard clause - return early if no lotData
    if (!lotData) {
        return (
            <div className="glass-card rounded-lg p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                </div>
            </div>
        );
    }

    // Raw company certs score — trivial expression, no memoization needed
    const rawCompanyCerts = results?.company_certs_score ?? 0;

    // Safety check
    if (!Array.isArray(lotData.reqs)) {
        return (
            <div className="text-center text-red-500 font-bold p-8">
                {t('errors.lot_data_unavailable')}
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Tab Navigation */}
            <div className="flex bg-white/30 backdrop-blur-xl border border-white/40 p-1.5 rounded-2xl shadow-sm">
                {[
                    { id: 'valutazione', label: 'Valutazione', icon: ClipboardCheck, desc: 'Input' },
                    { id: 'configurazione', label: 'Configurazione', icon: Settings, desc: 'Gara' },
                    { id: 'analisi', label: 'Analisi', icon: BarChart3, desc: 'Score & Chart' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl
                                 transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-white text-indigo-600 shadow-md scale-[1.02]'
                                : 'text-slate-500 hover:text-indigo-500 hover:bg-white/50'
                            }`}
                    >
                        <tab.icon className={`w-5 h-5 transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`} />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest font-display">{tab.label}</span>
                            <span className="hidden md:inline text-[8px] font-bold text-slate-400 uppercase tracking-widest-plus mt-0.5">{tab.desc}</span>
                        </div>
                    </button>
                ))}
            </div>

            {activeTab === 'valutazione' ? (
                <div className="space-y-6">
                    {/* Top Row: Cert. Aziendali (left) + Dettaglio Punteggi (right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                        {/* 1. Company Certifications */}
                        <div className="lg:col-span-1 glass-card rounded-[2rem] overflow-hidden border-white/60 shadow-xl shadow-slate-200/40 group">
                            <button
                                onClick={() => toggleSection('companyCerts')}
                                className="w-full px-6 py-4 border-b border-slate-100/50 flex justify-between items-center bg-white/40 hover:bg-white/60 transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform group-hover:rotate-6">
                                        <Star className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-black text-slate-800 font-display tracking-widest uppercase">{t('dashboard.company_certs')}</h3>
                                        <div className="flex items-center gap-4 mt-1">
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                                <span>Grezzo: {formatNumber(rawCompanyCerts, 2)} / {formatNumber(maxCompanyCerts, 2)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                                <span>Pesato: {formatNumber(results?.category_company_certs || 0, 2)} pt</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-slate-100/50 flex items-center justify-center border border-white group-hover:bg-white transition-all">
                                    {expandedSections.companyCerts ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                                </div>
                            </button>
                            {expandedSections.companyCerts && (
                                <div className="p-4 space-y-2">
                                    {lotData.company_certs && lotData.company_certs.length > 0 ? (
                                        lotData.company_certs.map((cert) => {
                                            const status = certs[cert.label] || "none";
                                            const statusColor = status === "all" ? "text-green-600" : status === "partial" ? "text-amber-600" : "text-red-500";
                                            const borderColor = status === "all" ? "border-green-300 bg-green-50" : status === "partial" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white";

                                            return (
                                                <div key={cert.label} className={`flex items-center justify-between gap-3 p-3 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md shadow-sm transition-all duration-300 hover:bg-white/80 hover:shadow-xl hover:shadow-indigo-500/5 group/row ${borderColor}`}>
                                                    <span className="text-sm font-black text-slate-800 flex-1 font-display uppercase tracking-tight transition-colors group-hover/row:text-emerald-600">{cert.label}</span>
                                                    <select
                                                        value={status}
                                                        onChange={(e) => setCertStatus(cert.label, e.target.value)}
                                                        className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest font-display border border-slate-200/50 outline-none cursor-pointer transition-all bg-white/60 backdrop-blur-sm ${statusColor} hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20`}
                                                    >
                                                        <option value="none">{t('tech.cert_absent')}</option>
                                                        {(cert.points_partial > 0) && (
                                                            <option value="partial">{t('tech.cert_partial')}</option>
                                                        )}
                                                        <option value="all">{t('tech.cert_complete')}</option>
                                                    </select>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-4 text-slate-400 text-sm italic">
                                            {t('config.no_certs')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Dettaglio Punteggi Tecnici — right column of top row */}
                        <div className="lg:col-span-2">
                            <DetailedScoreTable results={results} lotData={lotData} onNavigate={onNavigate} />
                        </div>
                    </div>{/* end top 3-col grid */}

                    {/* 2. Professional Certs */}
                    <div className="glass-card rounded-[2rem] overflow-hidden border-white/60 shadow-xl shadow-slate-200/40 group">
                        <button
                            onClick={() => toggleSection('profCerts')}
                            className="w-full px-6 py-4 border-b border-slate-100/50 bg-white/40 hover:bg-white/60 transition-all duration-300 flex justify-between items-center"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transition-transform group-hover:rotate-6">
                                    <Info className="w-5 h-5 text-white stroke-[2.5px]" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-black text-slate-800 font-display tracking-widest uppercase">{t('tech.prof_certs')}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                            <span>Grezzo: {formatNumber(rawProfCerts, 2)} / {formatNumber(maxProfCerts, 2)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                            <span>Pesato: {formatNumber(results?.category_resource || 0, 2)} pt</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-slate-100/50 flex items-center justify-center border border-white group-hover:bg-white transition-all">
                                {expandedSections.profCerts ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                            </div>
                        </button>
                        {expandedSections.profCerts && (
                            <div className="grid grid-cols-2 gap-4 p-4">
                                {lotData.reqs.filter(r => r.type === 'resource').length === 0 ? (
                                    <div className="text-center text-slate-400 text-sm italic py-4 col-span-2">
                                        ⚠️ {t('errors.no_prof_certs_configured')}
                                    </div>
                                ) : (
                                    lotData.reqs.filter(r => r.type === 'resource').map(req => {
                                        const cur = inputs[req.id] || { r_val: 0, c_val: 0 };
                                        const pts = results?.details[req.id] || 0;
                                        // Dynamic max values from configuration

                                        // Mostra sempre la formula, anche se prof_R/prof_C sono bassi o mancanti
                                        const maxR = typeof req.prof_R === 'number' ? req.prof_R : (typeof req.max_res === 'number' ? req.max_res : 1);
                                        const maxC = typeof req.prof_C === 'number' ? req.prof_C : (typeof req.max_certs === 'number' ? req.max_certs : 1);

                                        return (
                                            <div key={req.id} className="p-4 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all">

                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-900 font-display tracking-tight mb-2 uppercase">{req.label}</h4>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100/50 text-blue-800 text-[10px] font-black uppercase tracking-widest font-display">
                                                                <Info className="w-3 h-3 mr-1.5 text-blue-400" />
                                                                {t('tech.formula')}: (2 × R) + (R × C)
                                                            </span>
                                                        </div>
                                                        <p className="text-[9px] text-purple-600 font-black uppercase tracking-widest font-display mb-1 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                                                            {t('tech.config_required')}: R={maxR}, C={maxC} | Max {req.max_points}pt
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xl font-black text-blue-600 font-display">{formatNumber(pts, 2)}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 font-display tracking-widest-plus ml-1 uppercase">/ {formatNumber(req.max_points, 2)}</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50/40 backdrop-blur-sm rounded-xl border border-blue-100/30 hover:border-blue-200/50 transition-all group">
                                                        <span className="text-xs font-bold text-blue-700 uppercase tracking-tight">{t('tech.num_resources')} (R)</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    const newR = Math.max(0, cur.r_val - 1);
                                                                    updateInput(req.id, 'r_val', newR);
                                                                }}
                                                                className="p-1.5 rounded-lg hover:bg-blue-200/50 active:scale-90 transition-all text-blue-600 hover:text-blue-700 border border-transparent hover:border-blue-200 group-hover:opacity-100"
                                                                title={`Min: 0`}
                                                                aria-label={t('common.decrease')}
                                                            >
                                                                <Minus className="w-3.5 h-3.5" />
                                                            </button>
                                                            <div className="flex flex-col items-center justify-center min-w-[48px] px-2 py-1.5 bg-white/60 border border-blue-100 rounded-lg shadow-sm">
                                                                <span className="text-sm font-black text-blue-600 font-display leading-none">{cur.r_val}</span>
                                                                <span className="text-[9px] font-bold text-blue-400 tracking-tighter uppercase">/{maxR}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const newR = Math.min(maxR, cur.r_val + 1);
                                                                    updateInput(req.id, 'r_val', newR);
                                                                }}
                                                                className="p-1.5 rounded-lg hover:bg-blue-200/50 active:scale-90 transition-all text-blue-600 hover:text-blue-700 border border-transparent hover:border-blue-200 group-hover:opacity-100"
                                                                title={`Max: ${maxR}`}
                                                                aria-label={t('common.increase')}
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white/40 shadow-sm">
                                                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200/40">
                                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{t('common.certificates')} (C)</span>
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${cur.c_val > cur.r_val ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100/50 text-indigo-700 border border-indigo-200/50 shadow-sm'}`}>
                                                                {t('tech.total_c')}: {cur.c_val || 0}
                                                            </span>
                                                        </div>

                                                        <div className="flex flex-wrap gap-1">
                                                            {req.selected_prof_certs && req.selected_prof_certs.length > 0 ? (
                                                                req.selected_prof_certs.map(cert => {
                                                                    const count = (cur.cert_counts?.[cert]) || 0;
                                                                    // cert_company_counts: { certName: { 'Lutech': 2, 'Partner': 1 } }
                                                                    const companyCounts = cur.cert_company_counts?.[cert] || {};
                                                                    const assignedTotal = Object.values(companyCounts).reduce((s, v) => s + v, 0);
                                                                    const unassigned = count - assignedTotal;

                                                                    // RTI companies: Lutech always present, partners added if rti_enabled
                                                                    const rtiCompanies = lotData?.rti_enabled
                                                                        ? ['Lutech', ...(lotData.rti_companies || [])]
                                                                        : ['Lutech'];

                                                                    const updateCount = (delta) => {
                                                                        const counts = { ...(cur.cert_counts || {}) };
                                                                        const newVal = Math.max(0, count + delta);
                                                                        counts[cert] = newVal;

                                                                        const newTotalC = req.selected_prof_certs.reduce((s, c) => s + (counts[c] || 0), 0);
                                                                        const currentInput = inputs[req.id] || {};

                                                                        // If reducing count, also reduce company counts proportionally
                                                                        let newCompanyCounts = { ...(currentInput.cert_company_counts || {}) };
                                                                        if (delta < 0 && newCompanyCounts[cert]) {
                                                                            const certCompCounts = { ...newCompanyCounts[cert] };
                                                                            const currentAssigned = Object.values(certCompCounts).reduce((s, v) => s + v, 0);
                                                                            if (currentAssigned > newVal) {
                                                                                // Need to reduce company counts
                                                                                const excess = currentAssigned - newVal;
                                                                                let toReduce = excess;
                                                                                // Reduce from each company proportionally
                                                                                Object.keys(certCompCounts).forEach(comp => {
                                                                                    if (toReduce > 0 && certCompCounts[comp] > 0) {
                                                                                        const reduce = Math.min(certCompCounts[comp], toReduce);
                                                                                        certCompCounts[comp] -= reduce;
                                                                                        toReduce -= reduce;
                                                                                    }
                                                                                });
                                                                                newCompanyCounts[cert] = certCompCounts;
                                                                            }
                                                                        }

                                                                        setTechInput(req.id, {
                                                                            ...currentInput,
                                                                            cert_counts: counts,
                                                                            cert_company_counts: newCompanyCounts,
                                                                            c_val: newTotalC
                                                                        });
                                                                    };

                                                                    const updateCompanyCount = (company, delta) => {
                                                                        const currentInput = inputs[req.id] || {};
                                                                        const allCompanyCounts = { ...(currentInput.cert_company_counts || {}) };
                                                                        const certCompCounts = { ...(allCompanyCounts[cert] || {}) };
                                                                        const currentVal = certCompCounts[company] || 0;
                                                                        const currentAssigned = Object.values(certCompCounts).reduce((s, v) => s + v, 0);

                                                                        // Calculate new value with constraints
                                                                        let newVal = currentVal + delta;
                                                                        newVal = Math.max(0, newVal); // Can't go below 0
                                                                        newVal = Math.min(newVal, count - (currentAssigned - currentVal)); // Can't exceed total count

                                                                        certCompCounts[company] = newVal;
                                                                        allCompanyCounts[cert] = certCompCounts;

                                                                        setTechInput(req.id, {
                                                                            ...currentInput,
                                                                            cert_company_counts: allCompanyCounts
                                                                        });
                                                                    };

                                                                    return (
                                                                        <div key={cert} className="basis-[calc(50%-2px)] p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex flex-col gap-2">
                                                                            <div className="flex items-start justify-between gap-1.5">
                                                                                <span className="text-[10px] font-semibold text-slate-700 truncate flex-1 leading-tight" title={cert}>{cert}</span>
                                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                                    <button
                                                                                        onClick={() => updateCount(-1)}
                                                                                        className="p-1 min-w-[28px] min-h-[28px] rounded-md hover:bg-slate-200 active:bg-slate-300 text-slate-500 transition-colors flex items-center justify-center"
                                                                                        aria-label={t('common.decrease')}
                                                                                    >
                                                                                        <Minus className="w-3 h-3" />
                                                                                    </button>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        value={count}
                                                                                        onChange={(e) => {
                                                                                            const val = Math.min(maxC, Math.max(0, parseInt(e.target.value) || 0));
                                                                                            const counts = { ...(cur.cert_counts || {}) };
                                                                                            counts[cert] = val;
                                                                                            const newTotalC = req.selected_prof_certs.reduce((s, c) => s + (counts[c] || 0), 0);
                                                                                            const currentInput = inputs[req.id] || {};
                                                                                            setTechInput(req.id, {
                                                                                                ...currentInput,
                                                                                                cert_counts: counts,
                                                                                                c_val: newTotalC
                                                                                            });
                                                                                        }}
                                                                                        className="w-10 text-center bg-white border border-slate-200 rounded text-xs font-bold py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => updateCount(1)}
                                                                                        className="p-1 min-w-[28px] min-h-[28px] rounded-md hover:bg-slate-200 active:bg-slate-300 text-slate-500 transition-colors flex items-center justify-center"
                                                                                        aria-label={t('common.increase')}
                                                                                    >
                                                                                        <Plus className="w-3 h-3" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            {/* Per-company assignment with counters */}
                                                                            {count > 0 && rtiCompanies.length > 1 && (
                                                                                <div className="pt-2 border-t border-slate-200">
                                                                                    <div className="flex justify-between items-center gap-1.5 mb-1.5">
                                                                                        <span className="text-[8px] font-bold text-slate-500 uppercase">{t('tech.company_assignment')}</span>
                                                                                        {unassigned > 0 && (
                                                                                            <span className="text-[8px] font-bold text-amber-600">{t('tech.unassigned')}: {unassigned}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        {rtiCompanies.map(company => {
                                                                                            const compCount = companyCounts[company] || 0;
                                                                                            return (
                                                                                                <div key={company} className="flex items-center justify-between gap-1 bg-white rounded px-1.5 py-0.5 border border-slate-100">
                                                                                                    <span className="text-[9px] font-medium text-slate-600 truncate">{company}</span>
                                                                                                    <div className="flex items-center gap-0.5">
                                                                                                        <button
                                                                                                            onClick={() => updateCompanyCount(company, -1)}
                                                                                                            disabled={compCount === 0}
                                                                                                            className="p-0.5 rounded hover:bg-slate-100 active:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                                                                                                        >
                                                                                                            <Minus className="w-3 h-3" />
                                                                                                        </button>
                                                                                                        <span className={`w-5 text-center text-[10px] font-bold ${compCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                                                                            {compCount}
                                                                                                        </span>
                                                                                                        <button
                                                                                                            onClick={() => updateCompanyCount(company, 1)}
                                                                                                            disabled={unassigned === 0}
                                                                                                            className="p-0.5 rounded hover:bg-slate-100 active:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                                                                                                        >
                                                                                                            <Plus className="w-3 h-3" />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="text-[10px] text-slate-400 italic text-center py-2">
                                                                    {t('tech.no_certs_selected')}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {(!req.selected_prof_certs || req.selected_prof_certs.length === 0) && (
                                                            <div className="mt-4 pt-3 border-t border-slate-100">
                                                                <div className="flex items-center justify-between px-4 py-3 bg-indigo-50/40 backdrop-blur-sm rounded-xl border border-indigo-100/30 hover:border-indigo-200/50 transition-all group">
                                                                    <span className="text-xs font-semibold text-indigo-700 flex items-center uppercase tracking-tight">{t('tech.manual_adjustment')} (C)</span>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <button
                                                                            onClick={() => {
                                                                                const maxC = Math.max(10, cur.r_val);
                                                                                const newVal = Math.max(0, (cur.c_val || 0) - 1);
                                                                                updateInput(req.id, 'c_val', newVal);
                                                                            }}
                                                                            className="p-1.5 rounded-lg hover:bg-indigo-200/50 active:scale-90 transition-all text-indigo-600 hover:text-indigo-700 border border-transparent hover:border-indigo-200"
                                                                            aria-label={t('common.decrease')}
                                                                        >
                                                                            <Minus className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <div className="flex flex-col items-center justify-center min-w-[48px] px-2 py-1.5 bg-white/60 border border-indigo-100 rounded-lg shadow-sm">
                                                                            <span className="text-sm font-black text-indigo-600 font-display leading-none">{cur.c_val || 0}</span>
                                                                            <span className="text-[9px] font-bold text-indigo-400 tracking-tighter uppercase">/{Math.max(10, cur.r_val)}</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                const maxC = Math.max(10, cur.r_val);
                                                                                const newVal = Math.min(maxC, (cur.c_val || 0) + 1);
                                                                                updateInput(req.id, 'c_val', newVal);
                                                                            }}
                                                                            className="p-1.5 rounded-lg hover:bg-indigo-200/50 active:scale-90 transition-all text-indigo-600 hover:text-indigo-700 border border-transparent hover:border-indigo-200"
                                                                            aria-label={t('common.increase')}
                                                                        >
                                                                            <Plus className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {cur.c_val > cur.r_val && (
                                                            <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200 flex items-start gap-2">
                                                                <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                                                <p className="text-[9px] text-amber-700 leading-tight">
                                                                    <b>{t('common.warning')}:</b> {t('tech.certs_exceed_resources', { c: cur.c_val, r: cur.r_val })}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <div className="glass-card rounded-[2rem] overflow-hidden border-white/60 shadow-xl shadow-slate-200/40 group">
                        <button
                            onClick={() => toggleSection('projectRefs')}
                            className="w-full px-6 py-4 border-b border-slate-100/50 bg-white/40 hover:bg-white/60 transition-all duration-300 flex justify-between items-center"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 transition-transform group-hover:rotate-6">
                                    <Star className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-sm font-black text-slate-800 font-display tracking-widest uppercase">{t('tech.project_refs')}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                            <span>Grezzo: {formatNumber(rawProjectRefs, 2)} / {formatNumber(maxProjectRefs, 2)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                            <span>Pesato: {formatNumber(weightedProjectRefs, 2)} pt</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-slate-100/50 flex items-center justify-center border border-white group-hover:bg-white transition-all">
                                {expandedSections.projectRefs ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                            </div>
                        </button>
                        {expandedSections.projectRefs && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/10">
                                {lotData.reqs.filter(r => ['reference', 'project'].includes(r.type)).map(req => {
                                    const cur = inputs[req.id] || { qual_val: 'Adeguato', bonus_active: false };
                                    const pts = results?.details[req.id] || 0;

                                    // Function to build judgement options from criterion's levels
                                    const getJudgementOptions = (criterion) => {
                                        const levels = criterion?.judgement_levels;
                                        if (levels) {
                                            return [
                                                { value: levels.assente_inadeguato ?? 0, label: "Assente/Inadeguato", color: "bg-red-100 border-red-300 text-red-800" },
                                                { value: levels.parzialmente_adeguato ?? 2, label: "Parzialmente adeguato", color: "bg-orange-100 border-orange-300 text-orange-800" },
                                                { value: levels.adeguato ?? 3, label: "Adeguato", color: "bg-yellow-100 border-yellow-300 text-yellow-800" },
                                                { value: levels.piu_che_adeguato ?? 4, label: "Più che adeguato", color: "bg-lime-100 border-lime-300 text-lime-800" },
                                                { value: levels.ottimo ?? 5, label: "Ottimo", color: "bg-green-100 border-green-300 text-green-800" }
                                            ];
                                        }
                                        // Default values for backwards compatibility
                                        return [
                                            { value: 0, label: "Assente/Inadeguato", color: "bg-red-100 border-red-300 text-red-800" },
                                            { value: 2, label: "Parzialmente adeguato", color: "bg-orange-100 border-orange-300 text-orange-800" },
                                            { value: 3, label: "Adeguato", color: "bg-yellow-100 border-yellow-300 text-yellow-800" },
                                            { value: 4, label: "Più che adeguato", color: "bg-lime-100 border-lime-300 text-lime-800" },
                                            { value: 5, label: "Ottimo", color: "bg-green-100 border-green-300 text-green-800" }
                                        ];
                                    };

                                    // Calculate raw score for this requirement (WITH INTERNAL WEIGHTS)
                                    const reqRawScore = (() => {
                                        // Apply internal weights to sub-requirement values
                                        const subSum = cur.sub_req_vals?.reduce((subSum, sv) => {
                                            const sub = (req.sub_reqs || req.criteria || []).find(s => s.id === sv.sub_id);
                                            const weight = sub?.weight || 1;
                                            return subSum + ((sv.val || 0) * weight);
                                        }, 0) || 0;

                                        const attSum = cur.attestazione_active ? (req.attestazione_score || 0) : 0;
                                        const customSum = Object.entries(cur.custom_metric_vals || {}).reduce((cSum, [, mVal]) =>
                                            cSum + (parseFloat(mVal) || 0), 0);
                                        const bonusSum = cur.bonus_active ? (req.bonus_val || 0) : 0;

                                        // Use max_points from config (already calculated with internal weights)
                                        const maxRaw = req.max_points || 0;

                                        return Math.min(subSum + attSum + customSum + bonusSum, maxRaw);
                                    })();

                                    const reqWeightedScore = results?.weighted_scores?.[req.id] || 0;
                                    // RTI companies: Lutech always present, partners added if rti_enabled
                                    const rtiCompanies = lotData?.rti_enabled
                                        ? ['Lutech', ...(lotData.rti_companies || [])]
                                        : ['Lutech'];
                                    const assignedCompany = cur.assigned_company || '';

                                    const setAssignedCompany = (company) => {
                                        const currentInput = inputs[req.id] || {};
                                        setTechInput(req.id, {
                                            ...currentInput,
                                            assigned_company: company
                                        });
                                    };

                                    return (
                                        <div key={req.id} className="bg-white/60 backdrop-blur-md p-4 rounded-[2rem] border border-white/60 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 hover:bg-white/80 group/req">
                                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4 pb-4 border-b border-white/60">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full group-hover/req:scale-y-110 transition-transform shadow-sm shadow-indigo-500/20"></div>
                                                        <h4 className="text-sm font-black text-slate-900 font-display tracking-tight uppercase">
                                                            {req.label}
                                                        </h4>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-3">
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                                            <span>Grezzo: {formatNumber(reqRawScore, 2)} / {formatNumber(req.max_points, 2)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                                            <span>Pesato: {formatNumber(reqWeightedScore, 2)} pt</span>
                                                        </div>
                                                    </div>
                                                    {/* Company assignment for project/reference */}
                                                    {rtiCompanies.length > 1 && (
                                                        <div className="flex items-center gap-3 mt-4">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest-plus font-display">Assegnato a:</span>
                                                            <select
                                                                value={assignedCompany}
                                                                onChange={(e) => setAssignedCompany(e.target.value)}
                                                                className="text-[11px] font-black uppercase tracking-tightest px-4 py-2 border border-slate-200/60 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-indigo-500/20 active:scale-95 transition-all outline-none text-indigo-600"
                                                            >
                                                                <option value="">Seleziona Società</option>
                                                                {rtiCompanies.map(company => (
                                                                    <option key={company} value={company}>{company}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-1 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 min-w-[120px]">
                                                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-display">Punteggio Pesato</div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-3xl font-black text-indigo-600 font-display tracking-tightest">{formatNumber(reqWeightedScore, 2)}</span>
                                                        <span className="text-xs font-black text-indigo-300 uppercase font-display">pt</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* 1. Sub-requirements / Criteria (Discretionary) */}
                                                {(req.sub_reqs || req.criteria)?.map(sub => {
                                                    const subVal = cur.sub_req_vals?.find(s => s.sub_id === sub.id)?.val ?? 0;
                                                    const weight = sub.weight || 1;
                                                    const contribution = weight * subVal;

                                                    return (
                                                        <div key={sub.id} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/40 shadow-inner group/sub transition-all hover:bg-white duration-300">
                                                            <div className="flex justify-between items-center mb-5">
                                                                <div className="flex flex-col gap-1.5">
                                                                    <span className="text-base font-black text-slate-800 font-display uppercase tracking-tight">{sub.label}</span>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-display">Grado:</span>
                                                                            <span className="text-xs font-black text-slate-600 font-display">{subVal}</span>
                                                                        </div>
                                                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-display">Peso:</span>
                                                                            <span className="text-xs font-black text-indigo-600 font-display">×{weight}</span>
                                                                        </div>
                                                                        <div className="w-1 h-1 rounded-full bg-indigo-200"></div>
                                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm text-[10px] font-black uppercase tracking-widest font-display">
                                                                            <span>Contributo: {contribution.toFixed(2)} pt</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                                {getJudgementOptions(sub).map(option => (
                                                                    <button
                                                                        key={option.value}
                                                                        onClick={() => {
                                                                            const newVal = option.value;
                                                                            const existingSubVals = cur.sub_req_vals || [];
                                                                            const updatedSubVals = existingSubVals.filter(s => s.sub_id !== sub.id);
                                                                            updatedSubVals.push({ sub_id: sub.id, val: newVal });
                                                                            updateInput(req.id, 'sub_req_vals', updatedSubVals);
                                                                        }}
                                                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 group/btn ${subVal === option.value
                                                                            ? `${option.color.replace('bg-', 'bg-opacity-40 bg-')} border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105 z-10`
                                                                            : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 active:scale-95'
                                                                            }`}
                                                                        aria-pressed={subVal === option.value}
                                                                    >
                                                                        <div className="text-[9px] font-black uppercase tracking-tightest mb-1 text-center leading-tight line-clamp-1">{option.label}</div>
                                                                        <div className={`text-xl font-black font-display transition-colors ${subVal === option.value ? 'text-indigo-600' : 'text-slate-300 group-hover/btn:text-indigo-400'}`}>
                                                                            {option.value}
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* 2. Attestazione Cliente */}
                                                {req.attestazione_score > 0 && (
                                                    <div className="p-4 bg-emerald-50/40 backdrop-blur-md rounded-[1.5rem] border border-emerald-100/50 shadow-sm hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
                                                        <div className="flex justify-between items-center">
                                                            <label className="flex items-center gap-4 cursor-pointer group/toggle">
                                                                <div className="relative">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={cur.attestazione_active || false}
                                                                        onChange={(e) => updateInput(req.id, 'attestazione_active', e.target.checked)}
                                                                        className="sr-only"
                                                                    />
                                                                    <div className={`w-10 h-10 border-2 rounded-xl flex items-center justify-center transition-all duration-300 ${cur.attestazione_active ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-white border-slate-200 group-hover/toggle:border-emerald-400'}`}>
                                                                        {cur.attestazione_active && (
                                                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight transition-colors group-hover/toggle:text-emerald-600 font-display">{t('tech_evaluator.attestazione_label')}</span>
                                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display mt-0.5">Bonus Attestazione Finale</div>
                                                                </div>
                                                            </label>
                                                            <div className="flex flex-col items-end bg-emerald-100/30 px-5 py-3 rounded-2xl border border-emerald-200/50">
                                                                <div className="text-[9px] text-emerald-600 uppercase font-black tracking-widest-plus font-display">{t('tech_evaluator.points_unit')}</div>
                                                                <div className="text-xl font-black text-emerald-600 font-display">+{cur.attestazione_active ? req.attestazione_score : 0}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 3. Voci Tabellari (Custom Metrics) */}
                                                {req.custom_metrics?.length > 0 && (
                                                    <div className="space-y-4 pt-6 mt-2 border-t border-white/60">
                                                        <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 font-display">{t('tech_evaluator.custom_metrics_section')}</h5>
                                                        <div className="grid grid-cols-1 gap-4">
                                                            {req.custom_metrics.map(metric => {
                                                                const mVal = cur.custom_metric_vals?.[metric.id] ?? metric.min_score;
                                                                return (
                                                                    <div key={metric.id} className="bg-indigo-50/30 p-3 rounded-2xl border border-indigo-100/40 flex items-center justify-between gap-4 hover:bg-white/80 transition-all duration-300 group/metric">
                                                                        <div className="min-w-0 flex-1">
                                                                            <span className="text-sm font-black text-slate-800 uppercase tracking-tight block truncate font-display group-hover/metric:text-indigo-600" title={metric.label}>{metric.label}</span>
                                                                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest font-display mt-0.5 block">Range: {metric.min_score} - {metric.max_score}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 shrink-0">
                                                                            <button
                                                                                onClick={() => {
                                                                                    const prev = cur.custom_metric_vals || {};
                                                                                    const val = Math.max(metric.min_score, (prev[metric.id] ?? metric.min_score) - 0.5);
                                                                                    updateInput(req.id, 'custom_metric_vals', { ...prev, [metric.id]: val });
                                                                                }}
                                                                                className="w-10 h-10 hover:bg-white rounded-xl border border-transparent shadow-sm hover:border-slate-200 active:scale-90 transition-all text-slate-400 hover:text-indigo-600 flex items-center justify-center"
                                                                                aria-label={t('common.decrease')}
                                                                            >
                                                                                <Minus className="w-5 h-5" />
                                                                            </button>
                                                                            <div className="flex flex-col items-center bg-white/80 px-4 py-2 rounded-xl border border-white shadow-sm min-w-[64px]">
                                                                                <div className="text-base font-black text-indigo-600 font-display leading-tight">{formatNumber(mVal, 1)}</div>
                                                                                <div className="text-[8px] font-black text-slate-400 uppercase font-display leading-none tracking-tightest mt-1">{t('tech_evaluator.points_unit')}</div>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const prev = cur.custom_metric_vals || {};
                                                                                    const val = Math.min(metric.max_score, (prev[metric.id] ?? metric.min_score) + 0.5);
                                                                                    updateInput(req.id, 'custom_metric_vals', { ...prev, [metric.id]: val });
                                                                                }}
                                                                                className="w-10 h-10 hover:bg-white rounded-xl border border-transparent shadow-sm hover:border-slate-200 active:scale-90 transition-all text-slate-400 hover:text-indigo-600 flex items-center justify-center"
                                                                                aria-label={t('common.increase')}
                                                                            >
                                                                                <Plus className="w-5 h-5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* 4. Legacy Bonus Flag - Hide if it contains Attestazione/Att./Volumi (migrated to attestazione_score/custom_metrics) */}
                                                {req.bonus_label &&
                                                    !req.bonus_label.includes("Attestazione Cliente") &&
                                                    !req.bonus_label.includes("Att.") &&
                                                    !req.bonus_label.includes("Volumi") && (
                                                        <label className="flex items-center gap-3 cursor-pointer group pt-2 border-t border-slate-100">
                                                            <input
                                                                type="checkbox"
                                                                checked={cur.bonus_active}
                                                                onChange={(e) => updateInput(req.id, 'bonus_active', e.target.checked)}
                                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors font-medium">{req.bonus_label}</span>
                                                        </label>
                                                    )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'configurazione' ? (
                <ConfigPage />
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {/* Main Stream (Left/Center) */}
                        <div className="lg:col-span-8 space-y-4">
                            <ScoreGauges
                                results={results}
                                lotData={lotData}
                                techInputs={inputs}
                                onExport={handleExport}
                                onExcelExport={handleExcelExport}
                                exportLoading={exportLoading}
                                excelExportLoading={excelExportLoading}
                            />
                            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                                <SimulationChart
                                    simulationData={simulationData}
                                    monteCarlo={monteCarlo}
                                    results={results}
                                    myDiscount={myDiscount}
                                    competitorDiscount={competitorDiscount}
                                />
                            </motion.div>
                        </div>

                        {/* Analytic Boxes (Right) */}
                        <div className="lg:col-span-4 space-y-4">
                            <CompetitorAnalysis />
                        </div>
                    </div>

                </div>
            )}

            {/* Hidden container per il PDF Export (PremiumReport) */}
            <div style={{ display: 'none' }}>
                {results && lotData && (
                    <PremiumReport
                        ref={reportRef}
                        lotKey={selectedLot}
                        simulationData={{
                            base_amount: lotData.base_amount,
                            technical_score: results.technical_score,
                            economic_score: results.economic_score,
                            total_score: results.total_score,
                            my_discount: myDiscount,
                            competitor_discount: competitorDiscount,
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
                        businessPlanData={simulationData?.business_plan || {}} // we will get the plan from sim context later
                        t={t}
                    />
                )}
            </div>
        </div>
    );
}
