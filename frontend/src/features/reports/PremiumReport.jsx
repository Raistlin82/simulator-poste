import React, { forwardRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from 'recharts';

/**
 * PremiumReport Component
 * Renders a visually stunning A4 report designed specifically for PDF export via react-to-print.
 * 
 * Props expected:
 * - simulationData: the full evaluation state (base amount, discounts, tech scores)
 * - lotConfig: configuration of the current lot (max scores, weights)
 * - details, categoryScores, businessPlanData, etc.
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
    const {
        baseAmount = 0,
        myDiscount = 0,
        competitorDiscount = 0,
        technicalScore = 0,
        economicScore = 0,
        totalScore = 0,
    } = simulationData || {};

    const maxTech = lotConfig?.max_tech_score || 70;
    const maxEcon = lotConfig?.max_econ_score || 30;

    const myPrice = baseAmount * (1 - myDiscount / 100);
    const competitorPrice = baseAmount * (1 - competitorDiscount / 100);

    // Helper formatting 
    const formatCurrency = (val) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
    const formatPercentage = (val) => `${Number(val).toFixed(2)}%`;

    const getProbColor = (prob) => {
        if (prob >= 60) return "text-emerald-500 bg-emerald-50 border-emerald-200";
        if (prob >= 40) return "text-amber-500 bg-amber-50 border-amber-200";
        return "text-rose-500 bg-rose-50 border-rose-200";
    };

    const probLabel = winProbability >= 60 ? "ALTA" : (winProbability >= 40 ? "MEDIA" : "BASSA");
    const probColors = getProbColor(winProbability);

    // --- Chart Data Formatting ---
    const pieData = [
        { name: 'Tecnico', value: technicalScore, color: '#1E3A8A' }, // dark blue
        { name: 'Economico', value: economicScore, color: '#3B82F6' }, // blue
        { name: 'Gap (su 100)', value: 100 - totalScore, color: '#E5E7EB' } // gray
    ];

    const categoryChartData = Object.entries(categoryScores || {}).map(([key, value]) => ({
        name: key === 'company_certs' ? 'Cert. Aziendali' :
            key === 'resource' ? 'Cert. Professionali' :
                key === 'reference' ? 'Referenze' :
                    key === 'project' ? 'Progetti' : key,
        Punteggio: value
    }));

    // --- Business Plan Data formatting ---
    const bpRevenues = businessPlanData?.totals?.revenues || 0;
    const bpCosts = businessPlanData?.totals?.costs || 0;
    const bpMargin = businessPlanData?.totals?.ebitda || 0;
    const bpMarginPct = bpRevenues > 0 ? (bpMargin / bpRevenues) * 100 : 0;

    const costBreakdownData = [
        { name: 'Hardware', value: businessPlanData?.costs?.hardware || 0 },
        { name: 'Software', value: businessPlanData?.costs?.software || 0 },
        { name: 'Servizi', value: businessPlanData?.costs?.services || 0 },
        { name: 'Canoni', value: businessPlanData?.costs?.recurring || 0 },
    ].filter(d => d.value > 0);

    const costColors = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc'];

    return (
        <div ref={ref} className="bg-white text-slate-900 font-sans print-container">
            {/* 
        Tailwind 'print:' modifiers are useful if printing normally, 
        but since we pass this ref to react-to-print, we style it as a strict series of A4 pages.
      */}
            <style type="text/css">
                {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          .a4-page {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 0 auto;
            position: relative;
            background: white;
            box-sizing: border-box;
            page-break-after: always;
            overflow: hidden;
          }
          .a4-page:last-child {
            page-break-after: auto;
          }
          .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
          }
        `}
            </style>

            {/* ======================= PAGE 1: COVER & EXECUTIVE SUMMARY ======================= */}
            <div className="a4-page bg-gradient-to-br from-slate-50 to-blue-50">

                {/* Header Ribbon */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-cyan-400"></div>

                {/* Logos & Stamp */}
                <div className="flex justify-between items-start mb-16 mt-4">
                    <div>
                        <div className="text-3xl font-black tracking-tighter text-blue-900">SIMULATOR<span className="text-cyan-500">PRO</span></div>
                        <div className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">Gare & Appalti Poste</div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-slate-800">{new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        <div className="text-xs text-slate-400 mt-1">ID: {Math.random().toString(36).substring(2, 9).toUpperCase()}</div>
                    </div>
                </div>

                {/* Title Block */}
                <div className="mb-12">
                    <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-4">
                        Report di<br /><span className="text-blue-600">Simulazione Gara</span>
                    </h1>
                    <div className="inline-block px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg text-lg shadow-lg">
                        {lotKey}
                    </div>
                </div>

                {/* KPIs Grid */}
                <div className="grid grid-cols-2 gap-6 mb-12">
                    {/* Main Score Card */}
                    <div className="col-span-2 glass-panel rounded-2xl p-8 relative overflow-hidden">
                        <div className="absolute -right-10 -bottom-10 opacity-10">
                            <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2z" /></svg>
                        </div>

                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <p className="text-sm uppercase font-bold text-slate-500 tracking-wider mb-2">Punteggio Totale Stimato</p>
                                <div className="text-6xl font-black text-slate-900">{totalScore.toFixed(1)} <span className="text-3xl text-slate-400 font-medium">/ 100</span></div>
                            </div>

                            <div className={`flex flex-col items-center justify-center p-6 rounded-full border-4 shadow-xl ${probColors} w-40 h-40`}>
                                <span className="text-sm font-bold uppercase tracking-widest opacity-80">Vittoria</span>
                                <span className="text-3xl font-black py-1">{probLabel}</span>
                                <span className="text-base font-bold opacity-90">{winProbability.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Sub Scores */}
                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Score Tecnico</p>
                            <div className="text-3xl font-black text-blue-900">{technicalScore.toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">Max: {maxTech}</div>
                        </div>
                        <div className="w-16 h-16 rounded-full border-4 border-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {((technicalScore / maxTech) * 100).toFixed(0)}%
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Score Economico</p>
                            <div className="text-3xl font-black text-cyan-600">{economicScore.toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">Max: {maxEcon}</div>
                        </div>
                        <div className="w-16 h-16 rounded-full border-4 border-cyan-100 flex items-center justify-center text-cyan-600 font-bold">
                            {((economicScore / maxEcon) * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>

                {/* Economic Summary */}
                <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden mb-12">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-3xl opacity-20 -mr-20 -mt-20"></div>

                    <h3 className="text-lg font-bold text-slate-300 mb-6 flex items-center">
                        <span className="w-8 h-px bg-slate-600 mr-4"></span> Sintesi Offerta Economica
                    </h3>

                    <div className="grid grid-cols-2 gap-x-12 gap-y-8 relative z-10">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Base d'Asta</p>
                            <p className="text-2xl font-medium">{formatCurrency(baseAmount)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Valore Offerta</p>
                            <p className="text-3xl font-bold text-cyan-400">{formatCurrency(myPrice)}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Sconto Richiesto</p>
                            <div className="flex items-center">
                                <p className="text-2xl font-bold">{myDiscount.toFixed(2)}%</p>
                                {myDiscount < competitorDiscount && (
                                    <span className="ml-3 px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs font-bold rounded">
                                        Rischio soglia: {competitorDiscount.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="border-l border-slate-700 pl-6">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Rispetto alla Best Offer</p>
                            <p className="text-xl font-medium">{formatCurrency(competitorPrice)} ({(competitorDiscount).toFixed(2)}%)</p>
                        </div>
                    </div>
                </div>

                {/* Footer info page 1 */}
                <div className="absolute bottom-8 left-20 right-20 flex justify-between items-center text-xs text-slate-400 border-t border-slate-200 pt-4">
                    <span>Generato automaticamente dal simulatore. Elaborazione proprietaria riservata.</span>
                    <span className="font-bold">Pagina 1 di 2</span>
                </div>

            </div>

            {/* ======================= PAGE 2: BUSINESS PLAN & DETAILS ======================= */}
            <div className="a4-page bg-white">

                <div className="absolute top-0 left-0 w-full h-1 bg-slate-900"></div>

                <div className="flex items-center justify-between mb-8 mt-4">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Business Plan & Analisi Dettagliata</h2>
                    <div className="text-sm font-bold text-slate-400">{lotKey}</div>
                </div>

                {/* Business Plan Summary Section */}
                {businessPlanData && (
                    <div className="mb-10">
                        <h3 className="text-xs uppercase tracking-widest font-bold text-blue-600 mb-4 border-b border-blue-100 pb-2">1. Sintesi Business Plan</h3>

                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ricavi Totali</p>
                                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(bpRevenues)}</p>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Costi Totali</p>
                                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(bpCosts)}</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Margine (EBITDA)</p>
                                <p className="text-xl font-bold text-blue-900 mt-1">{formatCurrency(bpMargin)}</p>
                            </div>
                            <div className="bg-blue-600 rounded-xl p-4 text-white shadow-md">
                                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wide">Margine %</p>
                                <p className="text-2xl font-black mt-1">{formatPercentage(bpMarginPct)}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-8 items-center">
                            <div className="col-span-1 h-48">
                                <p className="text-xs font-bold text-slate-500 mb-2 pl-4">Distribuzione Costi</p>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={costBreakdownData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={65}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {costBreakdownData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={costColors[index % costColors.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="col-span-2">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-slate-200">
                                            <th className="text-left font-bold text-slate-500 pb-2">Categoria Costo</th>
                                            <th className="text-right font-bold text-slate-500 pb-2">Importo</th>
                                            <th className="text-right font-bold text-slate-500 pb-2">% su Ricavi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {costBreakdownData.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2.5 flex items-center font-medium">
                                                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: costColors[idx] }}></span>
                                                    {item.name}
                                                </td>
                                                <td className="text-right py-2.5 font-medium">{formatCurrency(item.value)}</td>
                                                <td className="text-right py-2.5 text-slate-500">
                                                    {bpRevenues > 0 ? ((item.value / bpRevenues) * 100).toFixed(1) : 0}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Technical Score Breakdown */}
                <div className="mb-8">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-blue-600 mb-4 border-b border-blue-100 pb-2">2. Analisi Dettaglio Tecnico</h3>

                    <div className="grid grid-cols-5 gap-6">
                        <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-100 h-64">
                            <p className="text-xs font-bold text-slate-500 mb-4 text-center">Score Tecnico vs Economico</p>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="col-span-3">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="Punteggio" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Parameters & Configuration */}
                <div>
                    <h3 className="text-xs uppercase tracking-widest font-bold text-blue-600 mb-4 border-b border-blue-100 pb-2">3. Parametri di Configurazione</h3>
                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <tbody className="divide-y divide-slate-200">
                                <tr className="bg-white">
                                    <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3">Max Score Tecnico (Gara)</td>
                                    <td className="px-4 py-2.5 font-medium">{maxTech.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2.5 font-bold text-slate-600">Max Score Economico (Gara)</td>
                                    <td className="px-4 py-2.5 font-medium">{maxEcon.toFixed(2)}</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="px-4 py-2.5 font-bold text-slate-600">Fattore di Competitività (Alpha)</td>
                                    <td className="px-4 py-2.5 font-medium">{lotConfig?.alpha || 0.8}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2.5 font-bold text-slate-600">RTI Attivo</td>
                                    <td className="px-4 py-2.5 font-medium">{lotConfig?.rti_enabled ? 'Sì' : 'No'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer info page 2 */}
                <div className="absolute bottom-8 left-20 right-20 flex justify-between items-center text-xs text-slate-400 border-t border-slate-200 pt-4">
                    <span>Generato automaticamente dal simulatore. Elaborazione proprietaria riservata.</span>
                    <span className="font-bold">Pagina 2 di 2</span>
                </div>

            </div>
        </div>
    );
});

PremiumReport.displayName = 'PremiumReport';

export default PremiumReport;
