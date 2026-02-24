export const SkeletonCard = () => (
  <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-8 animate-pulse shadow-2xl shadow-slate-500/5">
    <div className="h-4 bg-slate-200/60 rounded-full w-3/4 mb-6"></div>
    <div className="h-20 bg-slate-200/40 rounded-3xl w-full mb-6"></div>
    <div className="space-y-3">
      <div className="h-3 bg-slate-200/40 rounded-full w-5/6"></div>
      <div className="h-3 bg-slate-200/40 rounded-full w-4/6"></div>
    </div>
  </div>
);

export const SkeletonGauge = () => (
  <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-10 flex flex-col items-center justify-center animate-pulse shadow-2xl shadow-slate-500/5 min-h-[300px]">
    <div className="w-40 h-40 rounded-full border-[12px] border-slate-100 flex items-center justify-center">
      <div className="w-20 h-8 bg-slate-100 rounded-xl"></div>
    </div>
    <div className="h-4 bg-slate-100 rounded-full w-24 mt-8"></div>
  </div>
);

export const LoadingSpinner = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin`}></div>
    </div>
  );
};

export const LoadingOverlay = ({ message = 'Caricamento...' }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 shadow-xl">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-slate-700 font-medium">{message}</p>
    </div>
  </div>
);
