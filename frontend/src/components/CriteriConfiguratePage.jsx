import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, ChevronDown, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const JUDGMENT_LEVELS = [
    { value: 5, label: "Ottimo", color: "green" },
    { value: 4, label: "Più che adeguato", color: "lime" },
    { value: 3, label: "Adeguato", color: "yellow" },
    { value: 2, label: "Parzialmente adeguato", color: "orange" },
    { value: 0, label: "Assente/Inadeguato", color: "red" }
];

export default function CriteriConfiguratePage({ lotKey, lotConfig, onBack, onSave }) {
    const [expandedReqs, setExpandedReqs] = useState({});
    const [editingCriteria, setEditingCriteria] = useState({});
    const [localJudgments, setLocalJudgments] = useState({});
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        // Inizializza la configurazione dai requisiti
        const initial = {};
        const initialJudgments = {};

        lotConfig?.reqs?.forEach(req => {
            if (req.type === 'reference' || req.type === 'project') {
                const criteria = req.criteria || req.sub_reqs || [];
                initial[req.id] = criteria.map(c => ({
                    id: c.id,
                    label: c.label,
                    weight: c.weight || 1
                }));

                initialJudgments[req.id] = {};
                if (lotConfig.state?.tech_inputs?.[req.id]?.sub_req_vals) {
                    lotConfig.state.tech_inputs[req.id].sub_req_vals.forEach(val => {
                        initialJudgments[req.id][val.sub_id] = val.val;
                    });
                }
            }
        });

        setEditingCriteria(initial);
        setLocalJudgments(initialJudgments);
    }, [lotConfig]);

    const handleToggleExpand = (reqId) => {
        setExpandedReqs(prev => ({
            ...prev,
            [reqId]: !prev[reqId]
        }));
    };

    const handleAddCriterion = (reqId) => {
        setEditingCriteria(prev => ({
            ...prev,
            [reqId]: [
                ...(prev[reqId] || []),
                {
                    id: `c_${Date.now()}`,
                    label: '',
                    weight: 1
                }
            ]
        }));
    };

    const handleRemoveCriterion = (reqId, criterionId) => {
        setEditingCriteria(prev => ({
            ...prev,
            [reqId]: prev[reqId].filter(c => c.id !== criterionId)
        }));

        setLocalJudgments(prev => ({
            ...prev,
            [reqId]: {
                ...prev[reqId],
                [criterionId]: undefined
            }
        }));
    };

    const handleUpdateCriterion = (reqId, criterionId, field, value) => {
        setEditingCriteria(prev => ({
            ...prev,
            [reqId]: prev[reqId].map(c =>
                c.id === criterionId ? { ...c, [field]: value } : c
            )
        }));
    };

    const handleSetJudgment = (reqId, criterionId, value) => {
        setLocalJudgments(prev => ({
            ...prev,
            [reqId]: {
                ...prev[reqId],
                [criterionId]: value
            }
        }));
    };

    const calculateScore = (reqId) => {
        const criteria = editingCriteria[reqId] || [];
        const judgments = localJudgments[reqId] || {};
        let total = 0;

        criteria.forEach(criterion => {
            const judgment = judgments[criterion.id] || 0;
            total += criterion.weight * judgment;
        });

        return parseFloat(total.toFixed(2));
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccessMsg("");

        try {
            // Salva ogni requisito con i suoi nuovi criteri
            for (const [reqId, criteria] of Object.entries(editingCriteria)) {
                if (criteria && criteria.length > 0) {
                    try {
                        await axios.post(`${API_URL}/config/${lotKey}/req/${reqId}/criteria`, criteria);
                    } catch (err) {
                        console.error(`Errore durante salvataggio ${reqId}:`, err);
                    }
                }
            }

            setSuccessMsg("✓ Configurazione salvata con successo!");
            setTimeout(() => setSuccessMsg(""), 3000);

            if (onSave) {
                onSave();
            }
        } catch (error) {
            console.error('Errore nel salvataggio:', error);
            alert('Errore nel salvataggio della configurazione');
        } finally {
            setSaving(false);
        }
    };

    const referenceReqs = lotConfig?.reqs?.filter(req =>
        req.type === 'reference' || req.type === 'project'
    ) || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-800 mb-2">
                            Configurazione Criteri - {lotKey}
                        </h1>
                        <p className="text-slate-600">
                            Definisci le voci (PA_i) e i loro pesi (Pe_i) per la valutazione discrezionale
                        </p>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-slate-600 hover:bg-white rounded-lg transition border border-slate-200"
                    >
                        ← Indietro
                    </button>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-blue-900">Formula di valutazione:</p>
                        <p className="text-sm text-blue-800 mt-1">
                            P<sub>max</sub> = Σ(Pe_i × V_i) dove Pe_i è il peso della voce e V_i è il giudizio (0-5)
                        </p>
                    </div>
                </div>

                {/* Success Message */}
                {successMsg && (
                    <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg mb-6">
                        {successMsg}
                    </div>
                )}

                {/* Requisiti */}
                <div className="space-y-4">
                    {referenceReqs.map(req => {
                        const criteria = editingCriteria[req.id] || [];
                        const isExpanded = expandedReqs[req.id];
                        const scoreValue = calculateScore(req.id);

                        return (
                            <div key={req.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header Requisito */}
                                <button
                                    onClick={() => handleToggleExpand(req.id)}
                                    className="w-full px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition border-b border-slate-200"
                                >
                                    <div className="flex items-center gap-4 flex-1 text-left">
                                        <ChevronDown
                                            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        />
                                        <div>
                                            <h3 className="font-semibold text-slate-800">{req.label}</h3>
                                            <p className="text-xs text-slate-500 mt-1">{req.id} · {req.type}</p>
                                        </div>
                                    </div>

                                    {/* Score Badge */}
                                    <div className="text-right ml-4">
                                        <div className="text-xs text-slate-500 font-medium mb-1">Pmax</div>
                                        <div className="text-2xl font-bold text-blue-600">
                                            {scoreValue.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-slate-400">/ {req.max_points}</div>
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                                        <div className="space-y-4 mb-6">
                                            {criteria.map((criterion) => {
                                                const judgment = localJudgments[req.id]?.[criterion.id] || 0;
                                                const contribution = criterion.weight * judgment;

                                                return (
                                                    <div key={criterion.id} className="bg-white p-4 rounded-lg border border-slate-200">
                                                        <div className="grid grid-cols-12 gap-4 mb-3">
                                                            {/* Label */}
                                                            <input
                                                                type="text"
                                                                value={criterion.label}
                                                                onChange={(e) => handleUpdateCriterion(req.id, criterion.id, 'label', e.target.value)}
                                                                placeholder="Nome voce (PA)"
                                                                className="col-span-4 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />

                                                            {/* Weight */}
                                                            <input
                                                                type="number"
                                                                min="0.1"
                                                                step="0.1"
                                                                value={criterion.weight}
                                                                onChange={(e) => handleUpdateCriterion(req.id, criterion.id, 'weight', parseFloat(e.target.value))}
                                                                placeholder="Peso Pe"
                                                                className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />

                                                            {/* Contribution Display */}
                                                            <div className="col-span-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                                                                <div className="text-xs text-blue-700 font-semibold">Contributo</div>
                                                                <div className="text-lg font-bold text-blue-600">{contribution.toFixed(2)}</div>
                                                            </div>

                                                            {/* Delete Button */}
                                                            <button
                                                                onClick={() => handleRemoveCriterion(req.id, criterion.id)}
                                                                className="col-span-1 p-2 hover:bg-red-100 rounded-lg transition text-red-600"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        {/* Judgment Selection */}
                                                        <div className="border-t border-slate-200 pt-3">
                                                            <div className="text-xs font-semibold text-slate-600 mb-2">Giudizio (V_i)</div>
                                                            <div className="grid grid-cols-5 gap-2">
                                                                {JUDGMENT_LEVELS.map(level => (
                                                                    <button
                                                                        key={level.value}
                                                                        onClick={() => handleSetJudgment(req.id, criterion.id, level.value)}
                                                                        className={`px-2 py-1.5 rounded border text-xs font-semibold transition-all ${judgment === level.value
                                                                            ? `bg-${level.color}-100 border-${level.color}-400 text-${level.color}-900 ring-2 ring-offset-2 ring-${level.color}-400`
                                                                            : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                                                                            }`}
                                                                    >
                                                                        <div>{level.label}</div>
                                                                        <div className="text-[10px] font-bold mt-0.5">{level.value}</div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Add Criterion Button */}
                                        <button
                                            onClick={() => handleAddCriterion(req.id)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium text-sm mb-4"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Aggiungi voce
                                        </button>

                                        {/* Score Summary */}
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="text-sm font-semibold text-blue-900">Punteggio Massimo (Pmax)</div>
                                                    <div className="text-xs text-blue-700 mt-1">Formula: Σ(Pe_i × V_i)</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-3xl font-bold text-blue-600">{scoreValue.toFixed(2)}</div>
                                                    <div className="text-xs text-blue-600 mt-1">su {req.max_points} max</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
                    <button
                        onClick={onBack}
                        className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium text-slate-700"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Salvataggio...' : 'Salva Configurazione'}
                    </button>
                </div>
            </div>
        </div>
    );
}
