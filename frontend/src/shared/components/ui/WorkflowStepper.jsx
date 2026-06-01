import { AlertTriangle, CheckCircle2, Circle, CircleDot } from 'lucide-react';

const STEP_THEME = {
  complete: {
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    iconClassName: 'text-emerald-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-amber-50 text-amber-700 border-amber-100',
    iconClassName: 'text-amber-500',
  },
  error: {
    icon: AlertTriangle,
    className: 'bg-rose-50 text-rose-700 border-rose-100',
    iconClassName: 'text-rose-500',
  },
  pending: {
    icon: Circle,
    className: 'bg-white/60 text-slate-500 border-white/70',
    iconClassName: 'text-slate-300',
  },
  active: {
    icon: CircleDot,
    className: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    iconClassName: 'text-indigo-500',
  }
};

export default function WorkflowStepper({ steps, currentView, onNavigate, compact = false }) {
  if (!steps?.length) return null;

  return (
    <div className="space-y-2">
      {steps.map((step) => {
        const isActive = currentView === step.view;
        const theme = STEP_THEME[isActive ? 'active' : step.status] || STEP_THEME.pending;
        const Icon = theme.icon;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onNavigate?.(step.view)}
            className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${theme.className}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${theme.iconClassName}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-black uppercase tracking-widest font-display truncate">{step.label}</span>
              {!compact && (
                <span className="block text-[9px] font-bold uppercase tracking-widest-plus opacity-70 mt-0.5 truncate">
                  {step.detail}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
