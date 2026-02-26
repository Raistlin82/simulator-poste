import React, { forwardRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

/**
 * PremiumReport Component
 * Renders a visually stunning A4 report for PDF export via react-to-print.
 *
 * IMPORTANT: All props from Dashboard/TechEvaluator use snake_case names.
 */
const PremiumReport = forwardRef(({
    lotKey,
    simulationData,
    lotConfig,
    details,
    categoryScores,
    winProbability,
    businessPlanData,
    t
}, ref) => {
    // ---- Extract simulation data (snake_case from Dashboard props) ----
    const baseAmount = simulationData?.base_amount || 0;
    const technicalScore = simulationData?.technical_score || 0;
    const economicScore = simulationData?.economic_score || 0;
    const totalScore = simulationData?.total_score || 0;
    const myDiscount = simulationData?.my_discount || 0;
    const competitorDiscount = simulationData?.competitor_discount || 0;

    const maxTech = lotConfig?.max_tech_score || 70;
    const maxEcon = lotConfig?.max_econ_score || 30;
    const myPrice = baseAmount * (1 - myDiscount / 100);
    const competitorPrice = baseAmount * (1 - competitorDiscount / 100);
    const reqs = lotConfig?.reqs || [];

    // ---- Helpers ----
    const fmt = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    const fmtDec = (val, d = 2) => Number(val || 0).toFixed(d);
    const pct = (val) => `${Number(val || 0).toFixed(1)}%`;

    const probLabel = winProbability >= 60 ? 'ALTA' : (winProbability >= 40 ? 'MEDIA' : 'BASSA');
    const probColor = winProbability >= 60 ? '#10b981' : (winProbability >= 40 ? '#f59e0b' : '#ef4444');
    const probBg = winProbability >= 60 ? '#ecfdf5' : (winProbability >= 40 ? '#fffbeb' : '#fef2f2');

    // ---- Category chart data ----
    const categoryLabels = {
        company_certs: 'Cert. Aziendali',
        resource: 'Risorse',
        reference: 'Referenze',
        project: 'Progetti'
    };
    const categoryChartData = Object.entries(categoryScores || {})
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
            name: categoryLabels[key] || key,
            score: Number(value)
        }));

    // ---- Business plan ----
    const bpRevenues = businessPlanData?.totals?.revenues || 0;
    const bpCosts = businessPlanData?.totals?.costs || 0;
    const bpMargin = businessPlanData?.totals?.ebitda || 0;
    const bpMarginPct = bpRevenues > 0 ? (bpMargin / bpRevenues) * 100 : 0;

    const costBreakdown = [
        { name: 'Hardware', value: businessPlanData?.costs?.hardware || 0 },
        { name: 'Software', value: businessPlanData?.costs?.software || 0 },
        { name: 'Servizi', value: businessPlanData?.costs?.services || 0 },
        { name: 'Canoni', value: businessPlanData?.costs?.recurring || 0 },
    ].filter(d => d.value > 0);
    const costPalette = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc'];

    // Score composition pie
    const pieData = [
        { name: 'Tecnico', value: technicalScore, color: '#1e3a8a' },
        { name: 'Economico', value: economicScore, color: '#3b82f6' },
        { name: 'Gap', value: Math.max(0, 100 - totalScore), color: '#e5e7eb' }
    ];

    return (
        <div ref={ref} style={{ background: '#fff', color: '#0f172a', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
            <style type="text/css">{`
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
                .report-page {
                    width: 210mm; min-height: 297mm; padding: 15mm 18mm;
                    margin: 0 auto; position: relative; background: white;
                    box-sizing: border-box; page-break-after: always; overflow: hidden;
                }
                .report-page:last-child { page-break-after: auto; }
            `}</style>

            {/* ======================== PAGE 1: COVER + EXECUTIVE SUMMARY ======================== */}
            <div className="report-page" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' }}>
                {/* Top accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #1e40af, #06b6d4)' }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '8mm', marginBottom: '12mm' }}>
                    <div>
                        <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px', color: '#1e3a8a' }}>
                            SIMULATOR<span style={{ color: '#06b6d4' }}>PRO</span>
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', marginTop: '4px' }}>
                            Report Simulazione Gara
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                            {new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <div style={{ display: 'inline-block', marginTop: '6px', padding: '4px 14px', background: '#0f172a', color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: 800 }}>
                            {lotKey}
                        </div>
                    </div>
                </div>

                {/* Total Score Hero */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                    <div style={{ flex: 1, background: '#fff', borderRadius: '16px', padding: '24px 28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>Punteggio Totale</div>
                        <div style={{ fontSize: '52px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                            {fmtDec(totalScore, 1)} <span style={{ fontSize: '24px', color: '#94a3b8', fontWeight: 500 }}>/ 100</span>
                        </div>
                    </div>
                    <div style={{ width: '140px', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `3px solid ${probColor}`, background: probBg }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: probColor, textTransform: 'uppercase', letterSpacing: '2px' }}>Vittoria</div>
                        <div style={{ fontSize: '26px', fontWeight: 900, color: probColor, margin: '4px 0' }}>{probLabel}</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: probColor }}>{fmtDec(winProbability, 1)}%</div>
                    </div>
                </div>

                {/* Sub-scores */}
                <div style={{ display: 'flex', gap: '14px', marginBottom: '24px' }}>
                    <div style={{ flex: 1, background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Score Tecnico</div>
                                <div style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a', marginTop: '4px' }}>{fmtDec(technicalScore)}</div>
                                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Max: {fmtDec(maxTech)}</div>
                            </div>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#2563eb' }}>
                                {maxTech > 0 ? Math.round((technicalScore / maxTech) * 100) : 0}%
                            </div>
                        </div>
                    </div>
                    <div style={{ flex: 1, background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Score Economico</div>
                                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0891b2', marginTop: '4px' }}>{fmtDec(economicScore)}</div>
                                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Max: {fmtDec(maxEcon)}</div>
                            </div>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid #cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#0891b2' }}>
                                {maxEcon > 0 ? Math.round((economicScore / maxEcon) * 100) : 0}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* Economic Offer Section */}
                <div style={{ background: '#0f172a', borderRadius: '16px', padding: '24px 28px', color: '#fff', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: '#1e40af', opacity: 0.15, filter: 'blur(40px)' }} />
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ width: '24px', height: '1px', background: '#475569' }} /> Offerta Economica
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Base d'Asta</div>
                            <div style={{ fontSize: '20px', fontWeight: 600 }}>{fmt(baseAmount)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Valore Offerta</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#22d3ee' }}>{fmt(myPrice)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Nostro Sconto</div>
                            <div style={{ fontSize: '20px', fontWeight: 800 }}>{pct(myDiscount)}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid #334155', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Best Offer (Competitor)</div>
                            <div style={{ fontSize: '18px', fontWeight: 600 }}>{fmt(competitorPrice)} ({pct(competitorDiscount)})</div>
                        </div>
                    </div>
                </div>

                {/* Category Score Breakdown */}
                {categoryChartData.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>Punteggi per Categoria</div>
                        <div style={{ height: '100px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                                    <Bar dataKey="score" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Page footer */}
                <div style={{ position: 'absolute', bottom: '12mm', left: '18mm', right: '18mm', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    <span>Generato automaticamente — SimulatorPRO © {new Date().getFullYear()}</span>
                    <span style={{ fontWeight: 700 }}>Pagina 1 di 2</span>
                </div>
            </div>

            {/* ======================== PAGE 2: DETAILED REQUIREMENTS + BUSINESS PLAN ======================== */}
            <div className="report-page">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#0f172a' }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6mm', marginBottom: '16px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Dettaglio Tecnico & Business Plan</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{lotKey}</div>
                </div>

                {/* Detailed Requirements Table */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', borderBottom: '2px solid #dbeafe', paddingBottom: '6px' }}>
                        1. Dettaglio Requisiti
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Requisito</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Raw</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Max</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, color: '#2563eb', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Pesato</th>
                                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Peso Gara</th>
                                <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Company Certs Row */}
                            <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                <td style={{ padding: '8px', fontWeight: 700, color: '#334155' }}>Certificazioni Aziendali</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>—</td>
                                <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{fmtDec(categoryScores?.company_certs)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmtDec(lotConfig?.company_certs?.reduce((s, c) => s + (c.gara_weight || 0), 0) || 0)}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, background: '#f0fdf4', color: '#16a34a' }}>✓</span>
                                </td>
                            </tr>
                            {/* Requirements rows */}
                            {reqs.map((req, idx) => {
                                const rawScore = details?.[req.id] || 0;
                                const maxRaw = req.max_points || 0;
                                const percentage = maxRaw > 0 ? (rawScore / maxRaw) * 100 : 0;
                                return (
                                    <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                        <td style={{ padding: '8px', fontWeight: 600, color: '#334155' }}>
                                            {req.label}
                                            <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '1px' }}>{req.id}</div>
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmtDec(rawScore, 1)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmtDec(maxRaw, 1)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{fmtDec(simulationData?.weighted_scores?.[req.id] || 0)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>{fmtDec(req.gara_weight || 0, 1)}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 700,
                                                background: percentage >= 100 ? '#f0fdf4' : '#fff7ed',
                                                color: percentage >= 100 ? '#16a34a' : '#ea580c'
                                            }}>
                                                {Math.round(percentage)}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Summary footer */}
                            <tr style={{ borderTop: '2px solid #1e3a8a' }}>
                                <td style={{ padding: '8px', fontWeight: 900, color: '#1e3a8a', fontSize: '11px' }}>TOTALE</td>
                                <td style={{ padding: '8px' }} />
                                <td style={{ padding: '8px' }} />
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900, color: '#1e3a8a', fontSize: '14px' }}>{fmtDec(technicalScore)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#94a3b8' }}>{fmtDec(maxTech)}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, background: '#1e3a8a', color: '#fff' }}>
                                        {maxTech > 0 ? Math.round((technicalScore / maxTech) * 100) : 0}%
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Business Plan Summary (if available) */}
                {businessPlanData && bpRevenues > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', borderBottom: '2px solid #dbeafe', paddingBottom: '6px' }}>
                            2. Sintesi Business Plan
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Ricavi</div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{fmt(bpRevenues)}</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Costi</div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{fmt(bpCosts)}</div>
                            </div>
                            <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px', border: '1px solid #bfdbfe' }}>
                                <div style={{ fontSize: '8px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1.5px' }}>EBITDA</div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>{fmt(bpMargin)}</div>
                            </div>
                            <div style={{ background: '#1e40af', borderRadius: '10px', padding: '12px', color: '#fff' }}>
                                <div style={{ fontSize: '8px', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Margine %</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '4px' }}>{pct(bpMarginPct)}</div>
                            </div>
                        </div>

                        {costBreakdown.length > 0 && (
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ width: '130px', height: '130px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4} dataKey="value">
                                                {costBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={costPalette[index % costPalette.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => fmt(value)} contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <table style={{ flex: 1, fontSize: '10px', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase' }}>Voce</th>
                                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase' }}>Importo</th>
                                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800, color: '#64748b', fontSize: '8px', textTransform: 'uppercase' }}>% Ricavi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {costBreakdown.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '5px 8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: costPalette[idx], display: 'inline-block' }} />
                                                    {item.name}
                                                </td>
                                                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(item.value)}</td>
                                                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#64748b' }}>
                                                    {bpRevenues > 0 ? ((item.value / bpRevenues) * 100).toFixed(1) : 0}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Configuration Parameters */}
                <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px', borderBottom: '2px solid #dbeafe', paddingBottom: '6px' }}>
                        {businessPlanData && bpRevenues > 0 ? '3' : '2'}. Parametri di Configurazione
                    </div>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                        <tbody>
                            {[
                                ['Max Score Tecnico (Gara)', fmtDec(maxTech)],
                                ['Max Score Economico (Gara)', fmtDec(maxEcon)],
                                ['Fattore Competitività (Alpha)', lotConfig?.alpha || 0.8],
                                ['RTI Attivo', lotConfig?.rti_enabled ? 'Sì' : 'No'],
                                ['N° Requisiti', reqs.length],
                            ].map(([label, value], idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#475569', width: '55%' }}>{label}</td>
                                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>{value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Page footer */}
                <div style={{ position: 'absolute', bottom: '12mm', left: '18mm', right: '18mm', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    <span>Generato automaticamente — SimulatorPRO © {new Date().getFullYear()}</span>
                    <span style={{ fontWeight: 700 }}>Pagina 2 di 2</span>
                </div>
            </div>
        </div>
    );
});

PremiumReport.displayName = 'PremiumReport';

export default PremiumReport;
