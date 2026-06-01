import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ValidationSummary({ issues, title = 'Validazione configurazione' }) {
  const visibleIssues = issues || [];
  const errors = visibleIssues.filter((issue) => issue.severity === 'error');
  const warnings = visibleIssues.filter((issue) => issue.severity === 'warning');

  if (visibleIssues.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4 text-emerald-700 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest font-display">{title}</div>
          <div className="text-xs font-bold mt-0.5">Nessuna anomalia rilevata.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-4 text-amber-800">
      <div className="flex items-center gap-3 mb-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest font-display">{title}</div>
          <div className="text-xs font-bold mt-0.5">
            {errors.length} errori, {warnings.length} avvisi
          </div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {visibleIssues.slice(0, 6).map((issue, index) => (
          <li key={`${issue.message}-${index}`} className="flex items-start gap-2 text-xs font-semibold leading-snug">
            <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${issue.severity === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} />
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
      {visibleIssues.length > 6 && (
        <div className="mt-2 text-[10px] font-black uppercase tracking-widest opacity-70">
          +{visibleIssues.length - 6} ulteriori segnalazioni
        </div>
      )}
    </div>
  );
}
