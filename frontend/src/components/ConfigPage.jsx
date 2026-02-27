import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/formatters';
import { Plus, Trash2, Copy, Briefcase, FileCheck, Award, Info, TrendingUp, Search, X, Building2, PauseCircle } from 'lucide-react';
import LotSelector from '../features/config/components/LotSelector';
import CompanyCertsEditor from '../features/config/components/CompanyCertsEditor';
import { ConfirmDialog } from './ui/confirm-dialog';
import { useConfig } from '../features/config/context/ConfigContext';
import { useSimulation } from '../features/simulation/context/SimulationContext';

export default function ConfigPage({ onAddLot = () => { }, onDeleteLot = () => { } }) {
    const { t } = useTranslation();
    const { config, setConfig, masterData, refetch } = useConfig();
    const { selectedLot: globalSelectedLot, setLot: setGlobalLot } = useSimulation();
    const [editedConfig, setEditedConfig] = useState(() => JSON.parse(JSON.stringify(config)));
    // Initialize from global selected lot if available, otherwise first lot
    const [selectedLot, setSelectedLotLocal] = useState(() => globalSelectedLot || Object.keys(config)[0] || "");
    const [activeTab, setActiveTab] = useState('resource');
    const [certSearch, setCertSearch] = useState('');

    // Modal state for deletions
    const [deleteModalState, setDeleteModalState] = useState({
        isOpen: false,
        actionType: null, // 'requirement' | 'subReq' | 'customMetric' | 'companyCert'
        data: null
    });

    // Sync local selectedLot with global selectedLot when switching tabs
    useEffect(() => {
        if (globalSelectedLot && globalSelectedLot !== selectedLot && config[globalSelectedLot]) {
            setSelectedLotLocal(globalSelectedLot);
        }
    }, [globalSelectedLot, config, selectedLot]);

    // Update both local and global when user changes lot in ConfigPage
    const setSelectedLot = useCallback((lotKey) => {
        setSelectedLotLocal(lotKey);
        setGlobalLot(lotKey);
    }, [setGlobalLot]);

    // Track last synced value to prevent infinite loops between context <-> local state
    const lastSyncedToContextRef = useRef(JSON.stringify(config));

    // Sync FROM context when config changes externally (e.g. after onAddLot/onDeleteLot/refetch)
    useEffect(() => {
        const configStr = JSON.stringify(config);
        if (configStr !== lastSyncedToContextRef.current) {
            setEditedConfig(JSON.parse(configStr));
            lastSyncedToContextRef.current = configStr;
        }
    }, [config]);

    // Sync TO context whenever editedConfig changes (so unified save can access latest changes)
    useEffect(() => {
        const editedStr = JSON.stringify(editedConfig);
        if (editedStr !== lastSyncedToContextRef.current) {
            lastSyncedToContextRef.current = editedStr;
            setConfig(JSON.parse(editedStr));
        }
    }, [editedConfig, setConfig]);

    // For formatted display of Euro values
    const [displayBase, setDisplayBase] = useState("");

    const currentLot = editedConfig[selectedLot] || { name: "", base_amount: 0, max_tech_score: 60, max_econ_score: 40, max_raw_score: 100, reqs: [], company_certs: [] };

    // Prefill data for suggestions from Master Data
    const knownCerts = masterData?.company_certs || [];
    const knownLabels = masterData?.requirement_labels || [];
    const knownProfCerts = masterData?.prof_certs || [];

    // Auto-calculate max scores
    const calculateMaxTechScore = () => {
        let total = 0;
        // Sum gara_weight from company_certs
        if (currentLot.company_certs) {
            total += currentLot.company_certs.reduce((sum, c) => sum + (c.gara_weight || 0), 0);
        }
        // Sum gara_weight from requirements
        if (currentLot.reqs) {
            total += currentLot.reqs.reduce((sum, r) => sum + (r.gara_weight || 0), 0);
        }
        return total;
    };

    const calculateMaxRawScore = () => {
        let total = 0;
        // Sum points from company_certs
        if (currentLot.company_certs) {
            total += currentLot.company_certs.reduce((sum, c) => sum + (c.points || 0), 0);
        }
        // Sum max_points from requirements
        if (currentLot.reqs) {
            total += currentLot.reqs.reduce((sum, r) => sum + (r.max_points || 0), 0);
        }
        return total;
    };

    const calculated_max_tech_score = calculateMaxTechScore();
    const calculated_max_raw_score = calculateMaxRawScore();
    const calculated_max_econ_score = 100 - calculated_max_tech_score;

    // Helper to calculate max_points for a requirement (pure function, no mutation)
    // For 'resource' type: respects max_points_manual flag for manual override
    const calcRequirementMaxPoints = useCallback((req) => {
        if (req.type === 'resource') {
            // If manual override is set, return the existing max_points
            if (req.max_points_manual) {
                return req.max_points || 0;
            }
            const R = Math.max(0, parseInt(req.prof_R) || 0);
            const C = Math.min(R, Math.max(0, parseInt(req.prof_C) || 0));
            return (2 * R) + (R * C);
        } else if (req.type === 'reference' || req.type === 'project') {
            const subSum = req.sub_reqs?.reduce((s, r) => {
                const weight = parseFloat(r.weight) || 0;
                const maxValue = parseFloat(r.max_value) || 5;
                return s + (weight * maxValue);
            }, 0) || 0;
            const attSum = parseFloat(req.attestazione_score) || 0;
            const customSum = req.custom_metrics?.reduce((s, m) => s + (parseFloat(m.max_score) || 0), 0) || 0;
            return subSum + attSum + customSum;
        }
        return req.max_points || 0;
    }, []);

    // Helper function to update current lot immutably
    const updateLot = useCallback((updater) => {
        setEditedConfig(prev => {
            const newConfig = JSON.parse(JSON.stringify(prev));
            const lot = newConfig[selectedLot];
            if (lot) {
                updater(lot);
            }
            return newConfig;
        });
    }, [selectedLot]);

    // Update display when lot changes - this is intentional derived state for formatted input
    useEffect(() => {
        if (currentLot.base_amount) {
            setDisplayBase(formatNumber(currentLot.base_amount, 2));
        }
    }, [selectedLot, currentLot.base_amount]);

    // Auto-calculate Raw Score & Sync Individual Max Points
    // This effect computes derived values that must stay in sync with the source data
    useEffect(() => {
        if (!currentLot || !currentLot.reqs) return;

        // Check if any req needs max_points update
        let needsUpdate = false;
        const updatedReqs = currentLot.reqs.map(r => {
            const calculatedMax = calcRequirementMaxPoints(r);
            if (r.max_points !== calculatedMax) {
                needsUpdate = true;
                return { ...r, max_points: calculatedMax };
            }
            return r;
        });

        // Calculate totals
        const reqsTotal = updatedReqs.reduce((sum, r) => sum + (r.max_points || 0), 0);
        const certsTotal = currentLot.company_certs?.reduce((sum, c) => sum + (c.points || 0), 0) || 0;
        const total = reqsTotal + certsTotal;

        if (needsUpdate || currentLot.max_raw_score !== total) {
            updateLot(lot => {
                lot.reqs = updatedReqs;
                lot.max_raw_score = total;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLot.reqs, currentLot.company_certs, selectedLot, calcRequirementMaxPoints, updateLot, currentLot.max_raw_score]);

    const addRequirement = (type) => {
        const newReq = {
            id: "",
            label: t('config.new_requirement'),
            max_points: 0,
            type,
            ...(type === 'resource' && { prof_R: 1, prof_C: 1, selected_prof_certs: [], max_points_manual: false }),
            ...(type === 'reference' && { sub_reqs: [{ id: 'a', label: `${t('tech.criteria')} 1`, weight: 1.0, max_value: 5, judgement_levels: { ...defaultJudgementLevels } }], attestazione_score: 0, custom_metrics: [] }),
            ...(type === 'project' && { sub_reqs: [{ id: 'a', label: `${t('tech.criteria')} 1`, weight: 1.0, max_value: 5, judgement_levels: { ...defaultJudgementLevels } }], attestazione_score: 0, custom_metrics: [] })
        };
        newReq.max_points = calcRequirementMaxPoints(newReq);
        updateLot(lot => {
            if (!lot.reqs) lot.reqs = [];
            lot.reqs.push(newReq);
        });
    };

    const deleteRequirement = (reqId) => {
        const req = currentLot?.reqs?.find(r => r.id === reqId);
        setDeleteModalState({
            isOpen: true,
            actionType: 'requirement',
            data: { reqId, label: req?.label || t('config.requirement') }
        });
    };

    const duplicateRequirement = (reqId) => {
        updateLot(lot => {
            const src = lot.reqs?.find(r => r.id === reqId);
            if (!src) return;
            const clone = JSON.parse(JSON.stringify(src));
            // Generate a unique ID: try srcId_copy, srcId_copy2, ...
            const existingIds = new Set((lot.reqs || []).map(r => r.id));
            let newId = src.id ? `${src.id}_copy` : 'REQ_copy';
            let counter = 2;
            while (existingIds.has(newId)) {
                newId = src.id ? `${src.id}_copy${counter}` : `REQ_copy${counter}`;
                counter++;
            }
            clone.id = newId;
            clone.label = `${src.label} (${t('common.copy')})`;
            lot.reqs.push(clone);
        });
    };

    const updateRequirement = (reqId, field, value) => {
        updateLot(lot => {
            const req = lot.reqs?.find(r => r.id === reqId);
            if (req) {
                req[field] = value;
                req.max_points = calcRequirementMaxPoints(req);
            }
        });
    };

    const defaultJudgementLevels = {
        assente_inadeguato: 0,
        parzialmente_adeguato: 2,
        adeguato: 3,
        piu_che_adeguato: 4,
        ottimo: 5
    };

    const addSubReq = (reqId) => {
        updateLot(lot => {
            const req = lot.reqs?.find(r => r.id === reqId);
            if (req) {
                if (!req.sub_reqs) req.sub_reqs = [];
                const newId = String.fromCharCode(97 + req.sub_reqs.length);
                req.sub_reqs.push({
                    id: newId,
                    label: t('tech.criteria') + ' ' + (req.sub_reqs.length + 1),
                    weight: 1.0,
                    max_value: 5,
                    judgement_levels: { ...defaultJudgementLevels }
                });
                req.max_points = calcRequirementMaxPoints(req);
            }
        });
    };

    const updateSubReq = (reqId, subId, field, value) => {
        updateLot(lot => {
            const req = lot.reqs?.find(r => r.id === reqId);
            if (req && req.sub_reqs) {
                const sub = req.sub_reqs.find(s => s.id === subId);
                if (sub) {
                    sub[field] = value;
                    req.max_points = calcRequirementMaxPoints(req);
                }
            }
        });
    };

    const updateSubReqJudgementLevel = (reqId, subId, levelKey, value) => {
        updateLot(lot => {
            const req = lot.reqs?.find(r => r.id === reqId);
            if (req && req.sub_reqs) {
                const sub = req.sub_reqs.find(s => s.id === subId);
                if (sub) {
                    if (!sub.judgement_levels) {
                        sub.judgement_levels = { ...defaultJudgementLevels };
                    }
                    sub.judgement_levels[levelKey] = value;
                    // max_value derived from ottimo
                    sub.max_value = sub.judgement_levels.ottimo;
                    req.max_points = calcRequirementMaxPoints(req);
                }
            }
        });
    };

    const deleteSubReq = (reqId, subId) => {
        const req = currentLot?.reqs?.find(r => r.id === reqId);
        const sub = req?.sub_reqs?.find(s => s.id === subId);
        setDeleteModalState({
            isOpen: true,
            actionType: 'subReq',
            data: { reqId, subId, label: sub?.label || t('config.criterion') }
        });
    };

    const addCustomMetric = (reqId) => {
        updateLot(lot => {
            const req = lot.reqs?.find(r => r.id === reqId);
            if (req) {
                if (!req.custom_metrics) req.custom_metrics = [];
                const newId = `M${req.custom_metrics.length + 1}`;
                req.custom_metrics.push({ id: newId, label: t('config.new_custom_metric'), min_score: 0.0, max_score: 5.0 });
                req.max_points = calcRequirementMaxPoints(req);
            }
        });
    };

    const updateCustomMetric = (reqId, metricId, field, value) => {
        updateLot(lot => {
            const req = lot.reqs?.find(r => r.id === reqId);
            if (req && req.custom_metrics) {
                const metric = req.custom_metrics.find(m => m.id === metricId);
                if (metric) {
                    metric[field] = value;
                    req.max_points = calcRequirementMaxPoints(req);
                }
            }
        });
    };

    const deleteCustomMetric = (reqId, metricId) => {
        const req = currentLot?.reqs?.find(r => r.id === reqId);
        const metric = req?.custom_metrics?.find(m => m.id === metricId);
        setDeleteModalState({
            isOpen: true,
            actionType: 'customMetric',
            data: { reqId, metricId, label: metric?.label || t('config.new_custom_metric') }
        });
    };

    // Calculate professional certification score using formula: P = (2 * R) + (R * C)
    const calculateProfCertScore = (R, C) => {
        if (!R || !C) return 0;
        R = Math.max(0, parseInt(R) || 0);
        C = Math.max(0, parseInt(C) || 0);
        if (C > R) C = R;
        return (2 * R) + (R * C);
    };

    const addCompanyCert = () => {
        const defaultLabel = knownCerts.length > 0 ? knownCerts[0] : "";
        updateLot(lot => {
            if (!lot.company_certs) lot.company_certs = [];
            lot.company_certs.push({ label: defaultLabel, points: 2.0, points_partial: 1.0, gara_weight: 0 });
        });
    };

    const updateCompanyCert = (idx, label) => {
        updateLot(lot => {
            if (lot.company_certs && lot.company_certs[idx]) {
                lot.company_certs[idx].label = label;
            }
        });
    };

    const updateCompanyCertPoints = (idx, pts) => {
        updateLot(lot => {
            if (lot.company_certs && lot.company_certs[idx]) {
                lot.company_certs[idx].points = pts;
            }
        });
    };

    const updateCompanyCertPointsPartial = (idx, pts) => {
        updateLot(lot => {
            if (lot.company_certs && lot.company_certs[idx]) {
                lot.company_certs[idx].points_partial = pts;
            }
        });
    };

    const updateCompanyCertGaraWeight = (idx, weight) => {
        updateLot(lot => {
            if (lot.company_certs && lot.company_certs[idx]) {
                lot.company_certs[idx].gara_weight = weight;
            }
        });
    };

    const deleteCompanyCert = (idx) => {
        const cert = currentLot?.company_certs?.[idx];
        setDeleteModalState({
            isOpen: true,
            actionType: 'companyCert',
            data: { idx, label: cert?.label || t('config.company_cert_default') }
        });
    };

    const deleteLotConfirm = (lotKey) => {
        setDeleteModalState({
            isOpen: true,
            actionType: 'lot',
            data: { lotKey, label: lotKey }
        });
    };

    const handleDeleteConfirm = () => {
        const { actionType, data } = deleteModalState;
        if (!data) return;

        if (actionType === 'lot') {
            onDeleteLot(data.lotKey);
            setDeleteModalState({ isOpen: false, actionType: null, data: null });
            return;
        }

        updateLot(lot => {
            if (actionType === 'requirement') {
                lot.reqs = lot.reqs.filter(r => r.id !== data.reqId);
            } else if (actionType === 'subReq') {
                const req = lot.reqs?.find(r => r.id === data.reqId);
                if (req && req.sub_reqs) {
                    req.sub_reqs = req.sub_reqs.filter(s => s.id !== data.subId);
                    req.max_points = calcRequirementMaxPoints(req);
                }
            } else if (actionType === 'customMetric') {
                const req = lot.reqs?.find(r => r.id === data.reqId);
                if (req && req.custom_metrics) {
                    req.custom_metrics = req.custom_metrics.filter(m => m.id !== data.metricId);
                    req.max_points = calcRequirementMaxPoints(req);
                }
            } else if (actionType === 'companyCert') {
                if (lot.company_certs) {
                    lot.company_certs.splice(data.idx, 1);
                }
            }
        });

        setDeleteModalState({ isOpen: false, actionType: null, data: null });
    };

    const filteredReqs = currentLot.reqs?.filter(r => r.type === activeTab) || [];

    if (!selectedLot || !currentLot) return <div className="p-10 text-center">{t('config.no_config')}</div>;

    return (
        <div className="min-h-screen p-6 overflow-auto pb-32">
            <div className="max-w-7xl mx-auto space-y-10 pb-20">
                {/* Premium Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-2xl shadow-blue-500/5 transition-all duration-500 hover:shadow-blue-500/10 mb-2">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 -rotate-2 hover:rotate-0 transition-all duration-500 group">
                            <Briefcase className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 font-display tracking-tightest leading-tight">{t('config.config_gara')}</h1>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-display">{t('config.parametri_punteggi')}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest font-display">{selectedLot}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 bg-white/40 p-2 pl-6 rounded-3xl border border-white/60 shadow-sm min-w-[340px]">
                        <div className="flex-1">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 font-display">{t('config.lotto_attivo')}</div>
                            <LotSelector
                                config={editedConfig}
                                selectedLot={selectedLot}
                                onSelectLot={setSelectedLot}
                                onAddLot={onAddLot}
                                onDeleteLot={deleteLotConfirm}
                                onImportSuccess={async (lotKey) => {
                                    await refetch();
                                    setSelectedLot(lotKey);
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Datalists for suggestions from Master Data */}
                <datalist id="known-certs">
                    {knownCerts.map(c => <option key={c} value={c} />)}
                </datalist>
                <datalist id="known-labels">
                    {knownLabels.map(l => <option key={l} value={l} />)}
                </datalist>
                <datalist id="known-prof-certs">
                    {knownProfCerts.map(l => <option key={l} value={l} />)}
                </datalist>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="bg-white/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1 font-display">{t('config.lot_name')}</label>
                        <input
                            type="text"
                            value={currentLot.name}
                            onChange={(e) => {
                                const name = e.target.value;
                                updateLot(lot => { lot.name = name; });
                            }}
                            className="w-full p-4 bg-white/60 backdrop-blur-md border border-slate-200/60 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-black text-slate-800 transition-all font-display tracking-tight"
                        />
                        {/* Active/Closed Toggle */}
                        <div className="flex items-center justify-between gap-2 mt-5 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                            <span className={`text-[9px] font-black uppercase tracking-widest font-display ${currentLot.is_active !== false ? 'text-green-600' : 'text-slate-400'}`}>
                                {currentLot.is_active !== false ? t('config.lot_active') : t('config.lot_closed')}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    updateLot(lot => {
                                        lot.is_active = lot.is_active === false ? true : false;
                                    });
                                }}
                                className={`relative w-11 h-6 rounded-full transition-colors ${currentLot.is_active !== false ? 'bg-green-500 shadow-lg shadow-green-500/30' : 'bg-slate-300'
                                    }`}
                            >
                                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-500 ${currentLot.is_active !== false ? 'translate-x-5' : ''
                                    }`} />
                            </button>
                        </div>
                    </div>
                    <div className="bg-white/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500">
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1 font-display">{t('config.base_amount')}</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                <span className="text-slate-400 text-lg font-black font-display">€</span>
                            </div>
                            <input
                                type="text"
                                value={displayBase}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\./g, '').replace(',', '.');
                                    setDisplayBase(e.target.value);
                                    const parsed = parseFloat(raw);
                                    if (!isNaN(parsed) && parsed >= 0) {
                                        updateLot(lot => { lot.base_amount = parsed; });
                                    }
                                }}
                                onBlur={() => {
                                    setDisplayBase(formatNumber(Math.max(0, currentLot.base_amount || 0), 2));
                                }}
                                placeholder="0,00"
                                className="w-full pl-12 pr-5 py-4 bg-white/60 backdrop-blur-md border border-slate-200/60 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-display text-right text-xl font-black text-slate-900 transition-all shadow-inner"
                            />
                        </div>
                    </div>
                    <div className="bg-white/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 group/kpi">
                        <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 font-display">
                            {t('config.max_tech_score')}
                            <div className="group relative">
                                <Info className="w-3.5 h-3.5 text-slate-400 stroke-[2.5px] cursor-help" />
                                <div
                                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 p-4 bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-medium leading-relaxed rounded-[1.25rem] shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 border border-white/10"
                                >
                                    {t('config.max_tech_score_desc')}
                                </div>
                            </div>
                        </label>
                        <div className="flex flex-col gap-1">
                            <div className="text-4xl font-black text-emerald-600 font-display tracking-tightest group-hover/kpi:scale-110 transition-transform origin-left duration-500">{calculated_max_tech_score.toFixed(1)}</div>
                            <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest font-display">{t('config.auto_calculation')}</span>
                        </div>
                    </div>
                    <div className="bg-white/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 group/kpi">
                        <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 font-display">
                            {t('config.max_econ_score')}
                            <div className="group relative">
                                <Info className="w-3.5 h-3.5 text-slate-400 stroke-[2.5px] cursor-help" />
                                <div
                                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 p-4 bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-medium leading-relaxed rounded-[1.25rem] shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 border border-white/10"
                                >
                                    {t('config.max_econ_score_desc')}
                                </div>
                            </div>
                        </label>
                        <div className="flex flex-col gap-1">
                            <div className="text-4xl font-black text-indigo-600 font-display tracking-tightest group-hover/kpi:scale-110 transition-transform origin-left duration-500">{calculated_max_econ_score.toFixed(1)}</div>
                            <span className="text-[9px] font-black text-indigo-500/60 uppercase tracking-widest font-display">{t('config.auto_calculation')}</span>
                        </div>
                    </div>
                    <div className="bg-white/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 group/kpi">
                        <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 font-display">
                            {t('config.max_raw_score')}
                            <div className="group relative">
                                <Info className="w-3.5 h-3.5 text-slate-400 stroke-[2.5px] cursor-help" />
                                <div
                                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 p-4 bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-medium leading-relaxed rounded-[1.25rem] shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 border border-white/10"
                                >
                                    {t('config.max_raw_score_desc')}
                                </div>
                            </div>
                        </label>
                        <div className="flex flex-col gap-1">
                            <div className="text-4xl font-black text-purple-600 font-display tracking-tightest group-hover/kpi:scale-110 transition-transform origin-left duration-500">{calculated_max_raw_score.toFixed(1)}</div>
                            <span className="text-[9px] font-black text-purple-500/60 uppercase tracking-widest font-display">{t('config.max_raw_sum')}</span>
                        </div>
                    </div>
                </div>

                {/* RTI Toggle and Partner Selection */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest font-display">{t('config.rti_enabled_label')}</label>
                        <button
                            type="button"
                            onClick={() => {
                                updateLot(lot => {
                                    lot.rti_enabled = !lot.rti_enabled;
                                    // Clear selected partners if disabling RTI
                                    if (!lot.rti_enabled) {
                                        lot.rti_companies = [];
                                    }
                                });
                            }}
                            className={`relative w-11 h-6 rounded-full transition-colors ${currentLot.rti_enabled ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${currentLot.rti_enabled ? 'translate-x-5' : ''
                                }`} />
                        </button>
                        <span className={`text-[10px] font-black uppercase tracking-widest font-display ${currentLot.rti_enabled ? 'text-indigo-600' : 'text-slate-500'}`}>
                            {currentLot.rti_enabled ? t('config.rti_enabled_yes') : t('config.rti_enabled_no')}
                        </span>
                    </div>

                    {/* Partner Selection - only shown when RTI is enabled */}
                    {currentLot.rti_enabled && masterData?.rti_partners && masterData.rti_partners.length > 0 && (
                        <div className="mt-4 p-4 bg-indigo-50/50 backdrop-blur-md rounded-xl border border-indigo-200/50">
                            <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-widest font-display mb-3">{t('config.rti_partners_desc')}</p>
                            <div className="flex flex-wrap gap-2">
                                {masterData.rti_partners.map((company, idx) => {
                                    const lotRtiCompanies = currentLot.rti_companies || [];
                                    const isSelected = lotRtiCompanies.includes(company);
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                updateLot(lot => {
                                                    if (!lot.rti_companies) lot.rti_companies = [];
                                                    if (isSelected) {
                                                        lot.rti_companies = lot.rti_companies.filter(c => c !== company);
                                                    } else {
                                                        lot.rti_companies.push(company);
                                                    }
                                                });
                                            }}
                                            className={`px-3 py-1.5 text-[10px] uppercase font-black tracking-widest font-display rounded-lg border transition-all ${isSelected
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                                                : 'bg-white/50 border-indigo-200 text-indigo-700 hover:border-indigo-400 hover:bg-white'
                                                }`}
                                        >
                                            {company}
                                        </button>
                                    );
                                })}
                            </div>
                            {currentLot.rti_companies && currentLot.rti_companies.length > 0 && (
                                <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest font-display mt-3">
                                    {t('config.rti_selected_partners')}: <span className="text-indigo-800">Lutech + {currentLot.rti_companies.join(', ')}</span>
                                </p>
                            )}
                        </div>
                    )}
                    {currentLot.rti_enabled && (!masterData?.rti_partners || masterData.rti_partners.length === 0) && (
                        <p className="text-xs text-amber-600 mt-2">{t('config.rti_no_partners_warning')}</p>
                    )}
                </div>

                {/* Company Certifications */}
                <CompanyCertsEditor
                    companyCerts={currentLot.company_certs}
                    knownCerts={knownCerts}
                    onAdd={addCompanyCert}
                    onUpdate={updateCompanyCert}
                    onUpdatePoints={updateCompanyCertPoints}
                    onUpdatePointsPartial={updateCompanyCertPointsPartial}
                    onUpdateGaraWeight={updateCompanyCertGaraWeight}
                    onDelete={deleteCompanyCert}
                />

                {/* Economic Formula */}
                <div className="glass-card rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-amber-600" />
                        <h2 className="text-lg font-black text-slate-800 font-display tracking-tightest uppercase">{t('config.economic_formula_title')}</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Alpha */}
                            <div className="bg-green-50/40 backdrop-blur-md p-4 rounded-2xl border border-green-200/50">
                                <label className="block text-[10px] font-bold text-green-700 uppercase mb-2 tracking-widest font-display">{t('config.alpha_coeff')}</label>
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    max="1"
                                    value={currentLot.alpha || 0.3}
                                    onChange={(e) => {
                                        let val = parseFloat(e.target.value);
                                        if (isNaN(val)) val = 0.3;
                                        val = Math.max(0, Math.min(1, val)); // Clamp 0-1
                                        updateLot(lot => { lot.alpha = val; });
                                    }}
                                    className="w-full p-2 border border-green-200 bg-white shadow-inner rounded-xl focus:ring-2 focus:ring-green-500/50 outline-none font-black text-xl text-green-700 font-display text-center transition-all"
                                />
                            </div>

                            {/* Max Economic Score - Auto-calculated */}
                            <div className="bg-amber-50/40 backdrop-blur-md p-4 rounded-2xl border border-amber-200/50">
                                <label className="block text-[10px] font-bold text-amber-700 uppercase mb-2 tracking-widest font-display">{t('config.econ_score_label')}</label>
                                <div className="w-full p-2 bg-white/50 border border-amber-200 shadow-inner rounded-xl font-black text-xl text-amber-700 font-display text-center">
                                    {calculated_max_econ_score.toFixed(1)}
                                </div>
                            </div>

                            {/* Formula Selection */}
                            <div className="bg-blue-50/40 backdrop-blur-md p-4 rounded-2xl border border-blue-200/50">
                                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-2 tracking-widest font-display">{t('config.formula_type')}</label>
                                <select
                                    className="w-full p-2.5 border border-blue-200 shadow-inner bg-white rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-black text-sm text-blue-700 font-display appearance-none text-center cursor-pointer transition-all"
                                    value={currentLot.economic_formula || 'interp_alpha'}
                                    onChange={(e) => {
                                        const formula = e.target.value;
                                        updateLot(lot => { lot.economic_formula = formula; });
                                    }}
                                >
                                    {masterData?.economic_formulas?.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Formula Display with Dynamic Values */}
                        <div className="glass-card rounded-2xl p-6 bg-white/30 backdrop-blur-md border border-white/40">
                            <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest font-display">{t('config.dynamic_formula')}</h3>
                            <div className="glass-card rounded-lg p-4 border border-slate-200/50 font-mono text-sm text-slate-800 leading-relaxed space-y-3">
                                {(() => {
                                    const formula = masterData?.economic_formulas?.find(f => f.id === (currentLot.economic_formula || 'interp_alpha'))?.desc || t('config.no_formula');
                                    const alpha = (currentLot.alpha || 0.3).toFixed(2);
                                    const maxEcon = (currentLot.max_econ_score || 40).toFixed(1);

                                    const updatedFormula = formula
                                        .replace(/\\alpha/g, `(${alpha})`)
                                        .replace(/P\\_{.*?max.*?}/g, `(${maxEcon})`);

                                    return (
                                        <>
                                            <div>
                                                <div className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">{t('config.base_formula')}</div>
                                                <div className="text-slate-600 font-mono text-xs">{formula}</div>
                                            </div>
                                            {formula !== updatedFormula && (
                                                <>
                                                    <div className="border-t border-slate-200 my-3"></div>
                                                    <div>
                                                        <div className="text-xs font-bold text-blue-700 uppercase mb-2 tracking-wider">{t('config.with_your_values')}</div>
                                                        <div className="text-blue-700 font-bold text-base bg-blue-50 p-3 rounded border border-blue-200">{updatedFormula}</div>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requirements with Tabs */}
                <div className="glass-card rounded-3xl p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Award className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 font-display tracking-tightest uppercase">{t('config.lot_requirements')}</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('config.tech_score_config_desc')}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-2xl backdrop-blur-sm border border-white/40">
                        <button
                            onClick={() => setActiveTab('resource')}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest font-display ${activeTab === 'resource'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'text-slate-500 hover:bg-white/60'
                                }`}
                        >
                            <Award className={`w-4 h-4 ${activeTab === 'resource' ? 'text-white' : 'text-slate-400'}`} />
                            {t('tech.prof_certs')}
                        </button>
                        <button
                            onClick={() => setActiveTab('reference')}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest font-display ${activeTab === 'reference'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'text-slate-500 hover:bg-white/60'
                                }`}
                        >
                            <FileCheck className={`w-4 h-4 ${activeTab === 'reference' ? 'text-white' : 'text-slate-400'}`} />
                            {t('tech.references')}
                        </button>
                        <button
                            onClick={() => setActiveTab('project')}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest font-display ${activeTab === 'project'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'text-slate-500 hover:bg-white/60'
                                }`}
                        >
                            <Briefcase className={`w-4 h-4 ${activeTab === 'project' ? 'text-white' : 'text-slate-400'}`} />
                            {t('tech.projects')}
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-white/40 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-sm">
                        <button
                            onClick={() => addRequirement(activeTab)}
                            className="px-6 py-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-4 text-[11px] font-black uppercase tracking-widest font-display shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            <span>{activeTab === 'resource' ? t('config.add_cert') : activeTab === 'reference' ? t('config.add_reference') : t('config.add_project')}</span>
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="bg-white/60 backdrop-blur-md border border-indigo-200/50 rounded-2xl px-6 py-3 text-center shadow-lg shadow-indigo-500/5 min-w-[120px]">
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-display mb-1">{t('config.total_raw')}</div>
                                <div className="text-2xl font-black text-indigo-700 font-display tracking-tightest">{filteredReqs.reduce((s, r) => s + (r.max_points || 0), 0).toFixed(1)}</div>
                            </div>
                            <div className="bg-white/60 backdrop-blur-md border border-amber-200/50 rounded-2xl px-6 py-3 text-center shadow-lg shadow-amber-500/5 min-w-[120px]">
                                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest font-display mb-1">{t('config.total_weighted')}</div>
                                <div className="text-2xl font-black text-amber-700 font-display tracking-tightest">{filteredReqs.reduce((s, r) => s + (r.gara_weight || 0), 0).toFixed(1)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {filteredReqs.length > 0 ? (
                            filteredReqs.map((req) => (
                                <div key={req.id} className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/40 overflow-hidden group/req transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-1">
                                    {/* Header of the Requirement Card */}
                                    <div className="p-8 border-b border-white/60 bg-white/40">
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                                            <div className="flex-1 space-y-4 w-full">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-indigo-50/50 rounded-2xl flex items-center justify-center border border-indigo-100/50 group-hover/req:rotate-6 transition-transform">
                                                        <Award className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display mb-1">{t('config.req_title', 'Titolo Requisito')}</p>
                                                        <input
                                                            type="text"
                                                            value={req.label}
                                                            list="known-labels"
                                                            onChange={(e) => updateRequirement(req.id, 'label', e.target.value)}
                                                            className="text-xl font-black text-slate-800 bg-transparent border-none p-0 focus:ring-0 outline-none w-full font-display tracking-tight"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6 ml-16">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display">{t('config.req_id', 'Identificativo')}</span>
                                                        <input
                                                            type="text"
                                                            value={req.id}
                                                            placeholder={t('config.req_id_placeholder', 'E.g. REQ_01')}
                                                            onChange={(e) => updateRequirement(req.id, 'id', e.target.value)}
                                                            className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 focus:ring-2 focus:ring-indigo-500/20 outline-none w-40 uppercase tracking-tight mt-1"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display">{t('config.req_gara_weight', 'Peso Gara')}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.5"
                                                                value={req.gara_weight || 0}
                                                                onChange={(e) => updateRequirement(req.id, 'gara_weight', parseFloat(e.target.value) || 0)}
                                                                className="w-20 p-1.5 bg-amber-50/50 border border-amber-200/50 rounded-xl text-sm font-black text-center focus:ring-2 focus:ring-amber-500/20 outline-none font-display text-amber-700"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => duplicateRequirement(req.id)}
                                                    className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-indigo-100 shadow-sm hover:shadow-md"
                                                    title={t('common.duplicate')}
                                                >
                                                    <Copy className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteRequirement(req.id)}
                                                    className="p-3 text-slate-400 hover:text-rose-600 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-rose-100 shadow-sm hover:shadow-md"
                                                    title={t('common.delete')}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 space-y-8">


                                        {/* Professional Certification Configuration */}
                                        {req.type === 'resource' && (
                                            <div className="p-6 bg-purple-50/50 backdrop-blur-md rounded-2xl border border-purple-200/50">
                                                <div className="mb-6 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-black text-purple-800 text-sm uppercase tracking-tight font-display mb-1">{t('tech.prof_certs', 'Certificazioni Professionali')}</h4>
                                                        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest font-display">
                                                            P = (2 × R) + (R × C), dove R ≥ C
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                                    <div className="bg-white/50 p-4 rounded-xl border border-purple-200/50 shadow-sm">
                                                        <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest font-display mb-2 ml-1">{t('config.r_risorse', 'R - Risorse')}</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={req.prof_R || 1}
                                                            onChange={(e) => {
                                                                const newR = parseInt(e.target.value) || 1;
                                                                const newC = req.prof_C || 1;
                                                                updateLot(lot => {
                                                                    const r = lot.reqs?.find(x => x.id === req.id);
                                                                    if (r) {
                                                                        if (newC > newR) {
                                                                            r.prof_C = newR;
                                                                        }
                                                                        r.prof_R = newR;
                                                                        // Only update max_points if not manually set
                                                                        if (!r.max_points_manual) {
                                                                            r.max_points = calculateProfCertScore(newR, Math.min(newC, newR));
                                                                        }
                                                                    }
                                                                });
                                                            }}
                                                            className="w-full p-3 border border-purple-200 bg-white rounded-xl text-xl font-black text-center focus:ring-2 focus:ring-purple-500/50 outline-none font-display shadow-inner transition-all"
                                                        />
                                                    </div>

                                                    <div className="bg-white/50 p-4 rounded-xl border border-purple-200/50 shadow-sm">
                                                        <label className="block text-[10px] font-black text-purple-700 uppercase tracking-widest font-display mb-2 ml-1">{t('config.c_certificati', 'C - Certificati')}</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={req.prof_C || 1}
                                                            max={req.prof_R || 10}
                                                            onChange={(e) => {
                                                                const newC = parseInt(e.target.value) || 1;
                                                                const newR = req.prof_R || 1;
                                                                updateLot(lot => {
                                                                    const r = lot.reqs?.find(x => x.id === req.id);
                                                                    if (r) {
                                                                        r.prof_C = newC > newR ? newR : newC;
                                                                        // Only update max_points if not manually set
                                                                        if (!r.max_points_manual) {
                                                                            r.max_points = calculateProfCertScore(newR, r.prof_C);
                                                                        }
                                                                    }
                                                                });
                                                            }}
                                                            className="w-full p-3 border border-purple-200 bg-white rounded-xl text-xl font-black text-center focus:ring-2 focus:ring-purple-500/50 outline-none font-display shadow-inner transition-all"
                                                        />
                                                    </div>

                                                    <div className={`p-4 rounded-xl border transition-all shadow-sm ${req.max_points_manual ? 'bg-amber-100/50 border-amber-300' : 'bg-white/60 border-purple-200/50'}`}>
                                                        <div className="text-[10px] font-black text-purple-700 uppercase tracking-widest font-display mb-2 flex items-center justify-center gap-2">
                                                            {t('config.punteggio_max', 'Punteggio Max')}
                                                            {req.max_points_manual && (
                                                                <span className="text-[9px] font-black text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200 shadow-sm uppercase">{t('config.manual', 'manuale')}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-center gap-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="1"
                                                                value={req.max_points || calculateProfCertScore(req.prof_R || 1, Math.min(req.prof_C || 1, req.prof_R || 1))}
                                                                onChange={(e) => {
                                                                    const newValue = parseInt(e.target.value) || 0;
                                                                    const calculatedValue = calculateProfCertScore(req.prof_R || 1, Math.min(req.prof_C || 1, req.prof_R || 1));
                                                                    updateLot(lot => {
                                                                        const r = lot.reqs?.find(x => x.id === req.id);
                                                                        if (r) {
                                                                            r.max_points = newValue;
                                                                            r.max_points_manual = newValue !== calculatedValue;
                                                                        }
                                                                    });
                                                                }}
                                                                className={`w-20 text-2xl font-black text-center border-b-2 outline-none transition-all font-display ${req.max_points_manual ? 'border-amber-400 bg-transparent text-amber-700' : 'border-purple-200 bg-transparent text-purple-600'}`}
                                                            />
                                                            {req.max_points_manual && (
                                                                <button
                                                                    onClick={() => {
                                                                        const calculatedValue = calculateProfCertScore(req.prof_R || 1, Math.min(req.prof_C || 1, req.prof_R || 1));
                                                                        updateLot(lot => {
                                                                            const r = lot.reqs?.find(x => x.id === req.id);
                                                                            if (r) {
                                                                                r.max_points = calculatedValue;
                                                                                r.max_points_manual = false;
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="p-2 text-amber-600 hover:text-amber-800 hover:bg-white rounded-xl transition-all shadow-sm border border-amber-200/50"
                                                                    title={t('config.restore_auto_calc', 'Ripristina calcolo automatico')}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {!req.max_points_manual && (
                                                            <div className="text-[9px] font-bold text-purple-500/70 mt-3 text-center uppercase tracking-widest font-display">(2×{req.prof_R || 1}) + ({req.prof_R || 1}×{Math.min(req.prof_C || 1, req.prof_R || 1)})</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Certification Selection */}
                                                <div className="border-t border-purple-200/50 pt-6 mt-2">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h5 className="text-[11px] font-black text-purple-800 uppercase tracking-widest font-display">{t('config.selected_certs')}</h5>
                                                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-500/20 font-display">
                                                            {req.selected_prof_certs?.length || 0}
                                                        </span>
                                                    </div>

                                                    {/* Selected Chips */}
                                                    <div className="flex flex-wrap gap-2 mb-6">
                                                        {req.selected_prof_certs?.map(cert => (
                                                            <span key={cert} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-purple-200 text-purple-700 text-[10px] font-black rounded-xl shadow-sm hover:shadow-md transition-all group font-display uppercase tracking-tight">
                                                                {cert}
                                                                <button
                                                                    onClick={() => {
                                                                        const updated = req.selected_prof_certs.filter(c => c !== cert);
                                                                        updateRequirement(req.id, 'selected_prof_certs', updated);
                                                                    }}
                                                                    className="text-purple-300 hover:text-red-500 transition-colors"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                        {(!req.selected_prof_certs || req.selected_prof_certs.length === 0) && (
                                                            <div className="w-full text-center py-4 bg-white/30 rounded-xl border border-dashed border-purple-200/50 text-[10px] font-black text-purple-400 uppercase tracking-widest font-display">
                                                                {t('config.no_cert_selected', 'Nessuna certificazione selezionata')}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Search & Selection List */}
                                                    <div className="relative mb-4">
                                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                            <Search className="h-4 w-4 text-purple-400" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder={t('config.select_certs') + '...'}
                                                            value={certSearch}
                                                            onChange={(e) => setCertSearch(e.target.value)}
                                                            className="block w-full pl-11 pr-4 py-3 bg-white/50 border border-purple-200/50 rounded-xl text-xs font-black text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-display uppercase tracking-tight"
                                                        />
                                                    </div>

                                                    <div className="max-h-48 overflow-y-auto bg-white/40 backdrop-blur-md border border-purple-200/30 rounded-xl shadow-inner scrollbar-thin scrollbar-thumb-purple-200 scrollbar-track-transparent">
                                                        {knownProfCerts
                                                            .filter(cert => !req.selected_prof_certs?.includes(cert))
                                                            .filter(cert => cert.toLowerCase().includes(certSearch.toLowerCase()))
                                                            .map(cert => (
                                                                <button
                                                                    key={cert}
                                                                    onClick={() => {
                                                                        const current = req.selected_prof_certs || [];
                                                                        updateRequirement(req.id, 'selected_prof_certs', [...current, cert]);
                                                                        setCertSearch(''); // Clear search after selection
                                                                    }}
                                                                    className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-tight border-b border-purple-100/30 last:border-0 transition-all hover:bg-purple-600 hover:text-white text-slate-700 font-display"
                                                                >
                                                                    {cert}
                                                                </button>
                                                            ))}
                                                        {knownProfCerts.length === 0 && (
                                                            <div className="py-8 text-center">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-display">{t('config.no_certs_master_data', 'Nessuna certificazione in Master Data')}</p>
                                                            </div>
                                                        )}
                                                        {knownProfCerts.length > 0 && knownProfCerts.filter(cert => !req.selected_prof_certs?.includes(cert)).filter(cert => cert.toLowerCase().includes(certSearch.toLowerCase())).length === 0 && (
                                                            <div className="py-8 text-center">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-display">{t('config.no_results', 'Nessun risultato trovato')}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                        }

                                        {/* Sub-Requirements, Attestazione, and Custom Metrics (for reference/project) */}
                                        {(req.type === 'reference' || req.type === 'project') && (
                                            <div className="mt-4 space-y-4">
                                                {/* 1. Criteria & Weights */}
                                                <div className="p-6 bg-blue-50/40 backdrop-blur-md rounded-2xl border border-blue-200/50 shadow-sm">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <div className="flex items-center gap-6">
                                                            <div>
                                                                <h4 className="font-black text-blue-800 text-sm uppercase tracking-tight font-display">{t('config.criteria_and_weights', 'Criteri e Pesi')}</h4>
                                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-display">{t('config.raw_formula_desc', 'Raw = Σ(Peso_Interno × Max_Punteggio)')}</p>
                                                            </div>
                                                            <div className="bg-white/60 backdrop-blur-md px-4 py-2 rounded-xl border border-blue-200/50 text-center shadow-lg shadow-blue-500/5">
                                                                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest font-display mb-1">{t('config.max_req', 'Max Req')}</div>
                                                                <div className="text-xl font-black text-blue-600 font-display">{(req.max_points || 0).toFixed(1)}</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => addSubReq(req.id)}
                                                            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest font-display shadow-lg shadow-blue-500/20"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            {t('common.add')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {req.sub_reqs && req.sub_reqs.length > 0 ? (
                                                            req.sub_reqs.map((sub) => {
                                                                const levels = sub.judgement_levels || defaultJudgementLevels;
                                                                return (
                                                                    <div key={sub.id} className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-blue-200/50 shadow-sm space-y-4">
                                                                        {/* Row 1: ID, Label, Weight, Raw, Delete */}
                                                                        <div className="flex gap-4 items-center">
                                                                            <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-xl font-display text-xs font-black shrink-0 shadow-lg shadow-blue-500/20">{sub.id}</span>
                                                                            <input
                                                                                type="text"
                                                                                value={sub.label}
                                                                                onChange={(e) => updateSubReq(req.id, sub.id, 'label', e.target.value)}
                                                                                placeholder={t('tech.criteria') + ' ' + t('common.label', 'Label')}
                                                                                className="flex-1 px-4 py-2 border border-slate-200/50 bg-white shadow-inner rounded-xl text-xs font-black text-slate-700 focus:ring-2 focus:ring-blue-500/30 outline-none font-display uppercase tracking-tight"
                                                                            />
                                                                            <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/50">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-display">{t('config.weight', 'Peso')}</span>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.1"
                                                                                    min="0.1"
                                                                                    value={sub.weight}
                                                                                    onChange={(e) => updateSubReq(req.id, sub.id, 'weight', Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                                                                                    className="w-14 bg-transparent text-sm font-black text-blue-700 text-center outline-none font-display"
                                                                                    title={t('config.criteria_internal_weight', 'Peso interno del criterio')}
                                                                                />
                                                                            </div>
                                                                            <div className="text-[10px] font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200/50 font-display uppercase tracking-tightest">
                                                                                Raw: {((parseFloat(sub.weight) || 0) * (parseFloat(levels.ottimo) || 5)).toFixed(1)}
                                                                            </div>
                                                                            <button
                                                                                onClick={() => deleteSubReq(req.id, sub.id)}
                                                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm border border-slate-200/50"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                        {/* Row 2: 5 Judgement Level inputs */}
                                                                        <div className="flex gap-3 items-center pl-12">
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase shrink-0 font-display tracking-widest">{t('config.scores', 'Punteggi:')}</span>
                                                                            <div className="flex flex-wrap gap-3">
                                                                                <div className="flex gap-2 items-center bg-red-50/50 px-3 py-1 rounded-lg border border-red-100">
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.5"
                                                                                        min="0"
                                                                                        value={levels.assente_inadeguato ?? 0}
                                                                                        onChange={(e) => updateSubReqJudgementLevel(req.id, sub.id, 'assente_inadeguato', parseFloat(e.target.value) || 0)}
                                                                                        className="w-10 bg-transparent text-xs font-black text-red-700 text-center outline-none font-display"
                                                                                        title={t('config.absent_inadequate', 'Assente/Inadeguato')}
                                                                                    />
                                                                                    <span className="text-[8px] text-red-600 font-black uppercase font-display tracking-tightest">{t('config.score_ass', 'Ass.')}</span>
                                                                                </div>
                                                                                <div className="flex gap-2 items-center bg-orange-50/50 px-3 py-1 rounded-lg border border-orange-100">
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.5"
                                                                                        min="0"
                                                                                        value={levels.parzialmente_adeguato ?? 2}
                                                                                        onChange={(e) => updateSubReqJudgementLevel(req.id, sub.id, 'parzialmente_adeguato', parseFloat(e.target.value) || 0)}
                                                                                        className="w-10 bg-transparent text-xs font-black text-orange-700 text-center outline-none font-display"
                                                                                        title={t('config.partially_adequate', 'Parzialmente Adeguato')}
                                                                                    />
                                                                                    <span className="text-[8px] text-orange-600 font-black uppercase font-display tracking-tightest">{t('config.score_parz', 'Parz.')}</span>
                                                                                </div>
                                                                                <div className="flex gap-2 items-center bg-yellow-50/50 px-3 py-1 rounded-lg border border-yellow-200">
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.5"
                                                                                        min="0"
                                                                                        value={levels.adeguato ?? 3}
                                                                                        onChange={(e) => updateSubReqJudgementLevel(req.id, sub.id, 'adeguato', parseFloat(e.target.value) || 0)}
                                                                                        className="w-10 bg-transparent text-xs font-black text-yellow-700 text-center outline-none font-display"
                                                                                        title={t('config.adequate', 'Adeguato')}
                                                                                    />
                                                                                    <span className="text-[8px] text-yellow-600 font-black uppercase font-display tracking-tightest">{t('config.score_adeg', 'Adeg.')}</span>
                                                                                </div>
                                                                                <div className="flex gap-2 items-center bg-lime-50/50 px-3 py-1 rounded-lg border border-lime-200">
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.5"
                                                                                        min="0"
                                                                                        value={levels.piu_che_adeguato ?? 4}
                                                                                        onChange={(e) => updateSubReqJudgementLevel(req.id, sub.id, 'piu_che_adeguato', parseFloat(e.target.value) || 0)}
                                                                                        className="w-10 bg-transparent text-xs font-black text-lime-700 text-center outline-none font-display"
                                                                                        title={t('config.more_than_adequate', 'Più che Adeguato')}
                                                                                    />
                                                                                    <span className="text-[8px] text-lime-600 font-black uppercase font-display tracking-tightest">{t('config.score_more_adeg', '+Adeg.')}</span>
                                                                                </div>
                                                                                <div className="flex gap-2 items-center bg-green-50 px-3 py-1 rounded-lg border border-green-200 shadow-sm">
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.5"
                                                                                        min="0"
                                                                                        value={levels.ottimo ?? 5}
                                                                                        onChange={(e) => updateSubReqJudgementLevel(req.id, sub.id, 'ottimo', parseFloat(e.target.value) || 0)}
                                                                                        className="w-10 bg-transparent text-xs font-black text-green-700 text-center outline-none font-display"
                                                                                        title={t('config.excellent_max', 'Ottimo (= Max)')}
                                                                                    />
                                                                                    <span className="text-[8px] text-green-600 font-black uppercase font-display tracking-tightest">{t('config.score_ott', 'Ott.')}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="text-center py-6 bg-white/30 rounded-xl border border-dashed border-blue-200/50 text-[10px] font-black text-blue-400 uppercase tracking-widest font-display">
                                                                {t('config.no_subreqs', 'Nessun criterio definito')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 2. Attestazione Cliente */}
                                                <div className="p-6 bg-emerald-50/40 backdrop-blur-md rounded-2xl border border-emerald-200/50 shadow-sm">
                                                    <h4 className="font-black text-emerald-800 text-sm uppercase tracking-tight font-display mb-4">{t('config.attestazione_title')}</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="bg-white/50 p-4 rounded-xl border border-emerald-200/30">
                                                            <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest font-display mb-2 ml-1">{t('config.attestazione_score_label')}</label>
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                value={req.attestazione_score || 0.0}
                                                                onChange={(e) => updateRequirement(req.id, 'attestazione_score', parseFloat(e.target.value) || 0)}
                                                                className="w-full p-2.5 border border-emerald-200 bg-white shadow-inner rounded-xl text-lg font-black text-center focus:ring-2 focus:ring-emerald-500/50 outline-none font-display text-emerald-700 transition-all"
                                                            />
                                                        </div>
                                                        <div className="flex items-center">
                                                            <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest font-display leading-relaxed">
                                                                {t('config.attestazione_desc', { points: req.attestazione_score || 0 })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 3. Voci Tabellari (Custom Metrics) */}
                                                <div className="p-6 bg-orange-50/40 backdrop-blur-md rounded-2xl border border-orange-200/50 shadow-sm">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <div>
                                                            <h4 className="font-black text-orange-800 text-sm uppercase tracking-tight font-display mb-1">{t('config.custom_metrics_title')}</h4>
                                                            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest font-display">{t('config.custom_metrics_subtitle')}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => addCustomMetric(req.id)}
                                                            className="px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest font-display shadow-lg shadow-orange-500/20"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            {t('common.add')} {t('config.add_custom_metric')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {req.custom_metrics?.map((metric) => (
                                                            <div key={metric.id} className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-orange-200/30 shadow-sm flex flex-col gap-4">
                                                                <div className="flex justify-between items-center bg-white/40 p-2 rounded-lg border border-orange-100/50">
                                                                    <input
                                                                        type="text"
                                                                        value={metric.label}
                                                                        placeholder={t('config.custom_metric_placeholder')}
                                                                        onChange={(e) => updateCustomMetric(req.id, metric.id, 'label', e.target.value)}
                                                                        className="flex-1 bg-transparent text-sm font-black text-slate-800 placeholder-slate-400 outline-none px-2 font-display uppercase tracking-tight"
                                                                    />
                                                                    <button onClick={() => deleteCustomMetric(req.id, metric.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-white rounded-lg transition-all">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-6">
                                                                    <div className="bg-white/40 p-3 rounded-xl border border-orange-100/50">
                                                                        <label className="block text-[9px] font-black text-orange-700 uppercase tracking-widest font-display mb-1.5 ml-1">{t('config.min_points')}</label>
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            value={metric.min_score}
                                                                            onChange={(e) => updateCustomMetric(req.id, metric.id, 'min_score', parseFloat(e.target.value) || 0)}
                                                                            className="w-full bg-white/60 border border-orange-100 rounded-lg p-2 text-center text-sm font-black text-orange-700 font-display outline-none focus:ring-2 focus:ring-orange-500/30 shadow-inner"
                                                                        />
                                                                    </div>
                                                                    <div className="bg-white/40 p-3 rounded-xl border border-orange-100/50">
                                                                        <label className="block text-[9px] font-black text-orange-700 uppercase tracking-widest font-display mb-1.5 ml-1">{t('config.max_points_label')}</label>
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            value={metric.max_score}
                                                                            onChange={(e) => updateCustomMetric(req.id, metric.id, 'max_score', parseFloat(e.target.value) || 0)}
                                                                            className="w-full bg-white/60 border border-orange-100 rounded-lg p-2 text-center text-sm font-black text-orange-700 font-display outline-none focus:ring-2 focus:ring-orange-500/30 shadow-inner"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(!req.custom_metrics || req.custom_metrics.length === 0) && (
                                                            <div className="text-center py-4 text-orange-800/40 text-[10px] font-black uppercase tracking-widest font-display bg-white/30 rounded-xl border border-dashed border-orange-200/50">
                                                                {t('config.no_custom_metrics')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                <p>{t('config.no_reqs')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Deletion Confirm Dialog */}
                <ConfirmDialog
                    isOpen={deleteModalState.isOpen}
                    onClose={() => setDeleteModalState({ isOpen: false, actionType: null, data: null })}
                    onConfirm={handleDeleteConfirm}
                    title={t('common.confirm_deletion')}
                    description={t('common.confirm_deletion_desc', { item: deleteModalState.data?.label || '' }, `Sei sicuro di voler eliminare "${deleteModalState.data?.label || ''}"? Questa azione non può essere annullata.`)}
                />
            </div>
        </div>
    );
}
