import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, Loader2, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Gauge from '../../../shared/components/ui/Gauge';

/**
 * ScoreGauges - Display technical, economic, and total scores with gauges
 *
 * @param {Object} props
 * @param {Object} props.results - Calculation results with scores
 * @param {Object} props.lotData - Lot configuration data
 * @param {Object} props.techInputs - Technical inputs with assigned_company and cert_company_counts
 * @param {Function} props.onExport - Callback for PDF export
 * @param {Function} props.onExcelExport - Callback for Excel export
 * @param {boolean} props.exportLoading - PDF export loading state
 * @param {boolean} props.excelExportLoading - Excel export loading state
 */
export default function ScoreGauges({ results, lotData, techInputs, onExport, onExcelExport, exportLoading, excelExportLoading }) {
  const { t } = useTranslation();

  if (!results || !lotData) {
    return null;
  }

  // RTI companies: Lutech always present, partners added if rti_enabled
  const rtiCompanies = lotData?.rti_enabled
    ? ['Lutech', ...(lotData.rti_companies || [])]
    : ['Lutech'];
  const hasMultipleCompanies = rtiCompanies.length > 1;

  // Calculate per-company contributions
  const companyContributions = {};
  if (hasMultipleCompanies && techInputs && lotData.reqs) {
    // Initialize company totals
    rtiCompanies.forEach(company => {
      companyContributions[company] = {
        resource: 0,
        reference: 0,
        project: 0,
        total: 0
      };
    });

    // Iterate through requirements and attribute scores
    lotData.reqs.forEach(req => {
      const input = techInputs[req.id] || {};
      const weightedScore = results?.weighted_scores?.[req.id] || 0;
      const garaWeight = req.gara_weight || 0;

      if (req.type === 'reference' || req.type === 'project') {
        // Attribute MAX gara_weight (not calculated score) to assigned_company
        // This represents the potential/responsibility, not the evaluation
        const assignedCompany = input.assigned_company || 'Lutech';
        if (companyContributions[assignedCompany]) {
          companyContributions[assignedCompany][req.type] += garaWeight;
          companyContributions[assignedCompany].total += garaWeight;
        }
      } else if (req.type === 'resource') {
        // Split among cert_company_counts (how many certs each company contributes)
        const certCompanyCounts = input.cert_company_counts || {};
        const companyWeights = {};
        let totalCerts = 0;

        // Sum up cert counts per company across all certs
        Object.entries(certCompanyCounts).forEach(([, compCounts]) => {
          if (compCounts && typeof compCounts === 'object') {
            Object.entries(compCounts).forEach(([company, certCount]) => {
              if (rtiCompanies.includes(company) && certCount > 0) {
                companyWeights[company] = (companyWeights[company] || 0) + certCount;
                totalCerts += certCount;
              }
            });
          }
        });

        // Distribute score proportionally
        if (totalCerts > 0) {
          Object.entries(companyWeights).forEach(([company, count]) => {
            const proportion = count / totalCerts;
            const contribution = weightedScore * proportion;
            if (companyContributions[company]) {
              companyContributions[company].resource += contribution;
              companyContributions[company].total += contribution;
            }
          });
        }
      }
    });
  }

  // Calculate total attributable score (excludes company certs which are shared)
  const totalAttributable = Object.values(companyContributions).reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="bg-white/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/60 shadow-2xl shadow-blue-500/5 transition-all duration-500 hover:shadow-blue-500/10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest-plus font-display flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {t('dashboard.performance_score')}
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 ml-4.5 font-display">{t('dashboard.simulation_summary')}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={onExcelExport}
            disabled={excelExportLoading}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-white/60 border border-emerald-100 text-emerald-600 rounded-2xl hover:bg-emerald-50 transition-all font-black text-[10px] uppercase tracking-widest-plus font-display shadow-lg shadow-emerald-500/5 disabled:opacity-50 group"
            title={t('dashboard.export_excel')}
          >
            {excelExportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 group-hover:scale-110 transition-transform" />}
            Excel
          </button>
          <button
            onClick={onExport}
            disabled={exportLoading}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-3 bg-slate-800 text-white rounded-2xl hover:bg-slate-900 transition-all font-black text-[10px] uppercase tracking-widest-plus font-display shadow-xl shadow-slate-500/20 disabled:opacity-50 group"
          >
            {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />}
            {t('dashboard.export_pdf')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05, duration: 0.5 }}>
          <Gauge
            value={results.technical_score}
            max={results?.calculated_max_tech_score || lotData.max_tech_score || 60}
            color="#6366f1"
            label={t('dashboard.technical')}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.5 }}>
          <Gauge
            value={results.economic_score}
            max={lotData.max_econ_score || 40}
            color="#10b981"
            label={t('dashboard.economic')}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, duration: 0.5 }}>
          <Gauge
            value={results.total_score}
            max={100}
            color="#f59e0b"
            label={t('dashboard.total')}
          />
        </motion.div>
      </div>

      {/* Weighted Category Scores */}
      {(results.category_company_certs !== undefined ||
        results.category_resource !== undefined ||
        results.category_reference !== undefined ||
        results.category_project !== undefined) && (
          <div className="mt-8 pt-6 border-t border-white/60">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus mb-4 font-display text-center">{t('dashboard.weighted_scores_analysis')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t('dashboard.category_company_certs'), value: results.category_company_certs, color: 'from-purple-500 to-indigo-600', bg: 'bg-purple-50/50' },
                { label: t('dashboard.category_resource'), value: results.category_resource, color: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-50/50' },
                { label: t('dashboard.category_reference'), value: results.category_reference, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50/50' },
                { label: t('dashboard.category_project'), value: results.category_project, color: 'from-orange-500 to-amber-600', bg: 'bg-orange-50/50' }
              ].map((cat, i) => (
                <motion.div
                  key={cat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + (i * 0.07), duration: 0.4 }}
                  className={`${cat.bg} border border-white/60 backdrop-blur-md rounded-2xl p-3 shadow-sm hover:shadow-md transition-all duration-300 group`}
                >
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 font-display">{cat.label}</div>
                  <div className={`text-2xl font-black bg-gradient-to-br ${cat.color} bg-clip-text text-transparent font-display tabular-nums group-hover:scale-105 transition-transform origin-left uppercase`}>
                    {(cat.value || 0).toFixed(2)}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

      {/* RTI Company Contributions */}
      {hasMultipleCompanies && totalAttributable > 0 && (
        <div className="mt-8 pt-6 border-t border-white/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest-plus font-display">{t('dashboard.rti_contributions')}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-display">{t('dashboard.rti_split_subtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Shared RTI Score (Company Certs) */}
            {(results.category_company_certs || 0) > 0 && (
              <div className="bg-gradient-to-br from-purple-500/5 to-indigo-600/5 border border-purple-100 rounded-[2rem] p-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-110 transition-transform" />
                <div className="relative z-10 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest-plus font-display block mb-1">{t('dashboard.shared_rti_certs')}</span>
                    <div className="text-[9px] text-slate-500 font-medium font-display leading-tight max-w-[200px]">{t('dashboard.shared_rti_desc')}</div>
                  </div>
                  <div className="text-3xl font-black text-purple-600 font-display tabular-nums">
                    {(results.category_company_certs || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Per-Company Breakdown */}
            <div className="space-y-2">
              {rtiCompanies.map((company, i) => {
                const contrib = companyContributions[company] || { total: 0, resource: 0, reference: 0, project: 0 };
                const percentage = totalAttributable > 0 ? (contrib.total / totalAttributable * 100) : 0;
                const colors = i === 0 ? 'from-indigo-500 to-purple-600' : 'from-indigo-400 to-blue-500';

                return (
                  <motion.div
                    key={company}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="bg-white/60 border border-white/60 backdrop-blur-md rounded-2xl p-3 hover:bg-white/80 transition-all duration-300 shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${colors}`} />
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest font-display">{company}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-slate-800 font-display">{contrib.total.toFixed(2)}</span>
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50/80 px-2.5 py-1 rounded-full uppercase tracking-widest font-display">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Category dots breakdown */}
                    <div className="flex flex-wrap gap-3">
                      {[
                        { label: t('dashboard.category_resource'), val: contrib.resource, color: 'text-blue-500' },
                        { label: t('dashboard.category_reference'), val: contrib.reference, color: 'text-emerald-500' },
                        { label: t('dashboard.category_project'), val: contrib.project, color: 'text-orange-500' }
                      ].map(item => item.val > 0 && (
                        <div key={item.label} className="flex items-center gap-1.5 grayscale hover:grayscale-0 transition-all cursor-default">
                          <span className={`text-[9px] font-black uppercase tracking-tight ${item.color} font-display`}>{item.label}:</span>
                          <span className="text-[10px] font-bold text-slate-600 font-display">{item.val.toFixed(2)}</span>
                        </div>
                      ))}
                      {contrib.total === 0 && (
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest font-display opacity-50">{t('dashboard.no_contribution')}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Total Attributable */}
          <div className="mt-6 p-4 bg-slate-900 rounded-[2rem] flex justify-between items-center shadow-xl shadow-slate-900/10">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest-plus font-display">{t('dashboard.total_attributable')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-display tabular-nums leading-none">{totalAttributable.toFixed(2)}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-display leading-none">{t('dashboard.weighted_pts_unit')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
