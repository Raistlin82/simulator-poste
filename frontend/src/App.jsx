import { useState, useEffect, useRef, useCallback } from 'react';
import { bpSaveTrigger } from './utils/bpSaveTrigger';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import TechEvaluator from './components/TechEvaluator';
import Dashboard from './components/Dashboard';
import ConfigPage from './components/ConfigPage';
import MasterDataConfig from './components/MasterDataConfig';
import CertVerificationPage from './components/CertVerificationPage';
import BusinessPlanPage from './features/business-plan/pages/BusinessPlanPage';
import { BusinessPlanProvider } from './features/business-plan/context/BusinessPlanContext';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, Menu, Save } from 'lucide-react';
import { logger } from './utils/logger';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LogoutButton from './components/LogoutButton';
import { ConfigProvider, useConfig } from './features/config/context/ConfigContext';
import { SimulationProvider, useSimulation } from './features/simulation/context/SimulationContext';
import { ToastProvider, useToast } from './shared/components/ui/Toast';
import { API_URL } from './utils/api';

// Main app content (to be wrapped with auth)
function AppContent() {
  const { getAccessToken, handleCallback, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { success, error: showError } = useToast();
  // Force light mode — dark mode toggle hidden for now
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    try { localStorage.setItem('theme', 'light'); } catch { /* noop */ }
  }, []);

  // Use contexts instead of local state
  const { config, loading: configLoading, updateConfig, refetch: refetchConfig } = useConfig();
  const {
    selectedLot,
    myDiscount,
    competitorDiscount,
    competitorTechScore,
    competitorEconDiscount,
    techInputs,
    companyCerts,
    results,
    setLot,
    resetState,
    setResults,
    setSimulationData
  } = useSimulation();

  const [view, setView] = useState('dashboard'); // dashboard, config, master, certs, businessPlan
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const lastLoadedLot = useRef(null); // Track last loaded lot to prevent loops
  const isLoadingState = useRef(false); // Prevent auto-save during state load

  // Derived values from context
  const baseAmount = config && selectedLot && config[selectedLot] ? config[selectedLot].base_amount : 0;
  const mockMode = !config; // Demo mode if no config loaded

  // Configure axios interceptor to add auth token
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, [getAccessToken]);

  // Handle OIDC callback - wait for auth to be ready
  useEffect(() => {
    const handleOIDCCallback = async () => {
      if (window.location.pathname === '/callback' && !authLoading) {
        try {
          await handleCallback();
          setView('dashboard');
        } catch (err) {
          logger.error("OIDC callback failed", err, { component: "App" });
        }
      }
    };
    handleOIDCCallback();
  }, [handleCallback, authLoading]);

  // Update loading state when config loads - intentional derived state sync
  useEffect(() => {
    if (config !== null || configLoading === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
    }
  }, [config, configLoading]);

  // Auto-select last used lot when config loads and no lot is selected
  useEffect(() => {
    if (config && !selectedLot) {
      // Try to restore from localStorage first
      const lastLot = localStorage.getItem('lastSelectedLot');
      const activeLots = Object.keys(config).filter(k => config[k]?.is_active !== false);

      // Use last lot if it exists and is still active, otherwise use first active lot
      if (lastLot && config[lastLot] && config[lastLot]?.is_active !== false) {
        setLot(lastLot);
      } else if (activeLots.length > 0) {
        setLot(activeLots[0]);
      } else if (Object.keys(config).length > 0) {
        // Fallback: use first lot even if inactive
        setLot(Object.keys(config)[0]);
      }
    }
  }, [config, selectedLot, setLot]);

  // Update simulation state when lot changes - load saved state
  useEffect(() => {
    if (config && selectedLot && lastLoadedLot.current !== selectedLot) {
      const lot = config[selectedLot];

      // Load saved state if available, otherwise use defaults
      const newState = {
        selectedLot,
        myDiscount: lot.state?.my_discount ?? 0.0,
        competitorDiscount: lot.state?.competitor_discount ?? 30.0,
        competitorTechScore: lot.state?.competitor_tech_score ?? lot.max_tech_score ?? 60.0,
        competitorEconDiscount: lot.state?.competitor_econ_discount ?? 30.0,
        techInputs: lot.state?.tech_inputs ?? {},
        companyCerts: lot.state?.company_certs ?? {}
      };

      // Block auto-save during state load to prevent overwriting with stale data
      isLoadingState.current = true;

      resetState(newState);

      lastLoadedLot.current = selectedLot;

      // Re-enable auto-save and trigger recalculation after state has stabilized
      setTimeout(() => {
        isLoadingState.current = false;
      }, 500);
    }
  }, [selectedLot, config, resetState]);

  // Manual save function for simulation state
  const handleSaveState = useCallback(async () => {
    if (!config || !selectedLot) return false;
    try {
      const statePayload = {
        my_discount: myDiscount,
        competitor_discount: competitorDiscount,
        competitor_tech_score: competitorTechScore,
        competitor_econ_discount: competitorEconDiscount,
        tech_inputs: techInputs,
        company_certs: companyCerts
      };
      await axios.post(`${API_URL}/config/state?lot_key=${encodeURIComponent(selectedLot)}`, statePayload);

      // State saved to server successfully
      logger.info("Simulation state saved", { lot: selectedLot });

      return true;
    } catch (err) {
      logger.error("Failed to save state", err, { component: "App", lot: selectedLot });
      return false;
    }
  }, [config, selectedLot, myDiscount, competitorDiscount, competitorTechScore, competitorEconDiscount, techInputs, companyCerts]);

  // Unified save function for top bar button
  const handleUnifiedSave = async () => {
    if (!config || !selectedLot) {
      showError(t('app.no_config_to_save'));
      return;
    }

    try {
      logger.info("Starting unified save", { lot: selectedLot });

      // Save simulation state, configuration, and (if BP is open) the Business Plan
      const savePromises = [handleSaveState(), updateConfig(config)];
      if (bpSaveTrigger.fn) {
        savePromises.push(Promise.resolve(bpSaveTrigger.fn()).catch(err => {
          logger.warn("BP save failed during unified save", err);
        }));
      }

      const [stateSuccess, configResult] = await Promise.all(savePromises);

      logger.info("Save results", { stateSuccess, configSuccess: configResult.success });

      if (stateSuccess && configResult.success) {
        success(t('app.save_success'));
      } else {
        showError(t('app.save_error'));
      }
    } catch (err) {
      logger.error("Unified save failed", err, { component: "App" });
      showError(t('app.save_error'));
    }
  };

  // Debounced auto-save effect for simulation state
  useEffect(() => {
    if (!config || !selectedLot || loading || authLoading || !isAuthenticated) return;

    // Skip auto-save during state loading to prevent overwriting loaded data
    if (isLoadingState.current) return;

    // Capture current lot to prevent race condition when switching lots
    const currentLot = selectedLot;

    const timer = setTimeout(() => {
      // Double-check lot hasn't changed during debounce period
      if (currentLot === selectedLot) {
        handleSaveState();
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [handleSaveState, config, selectedLot, loading, authLoading, isAuthenticated, myDiscount, competitorDiscount, competitorTechScore, competitorEconDiscount, techInputs, companyCerts]);

  // Main Calculation Effect - with AbortController to prevent race conditions
  useEffect(() => {
    if (!config || !selectedLot || authLoading || !isAuthenticated) return;

    // Additional guard: ensure we have valid data from config
    if (!config[selectedLot] || baseAmount <= 0) return;

    const controller = new AbortController();

    const payload = {
      lot_key: selectedLot,
      base_amount: baseAmount,
      competitor_discount: competitorDiscount,
      my_discount: myDiscount,
      tech_inputs: Object.entries(techInputs).map(([k, v]) => ({ req_id: k, ...v })),
      company_certs_status: companyCerts  // { label: "all"|"partial"|"none" }
    };

    // Calculate Scores with abort signal
    axios.post(`${API_URL}/calculate`, payload, { signal: controller.signal })
      .then(res => setResults(res.data))
      .catch(err => {
        // Ignore abort errors
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          logger.error("Calculation failed", err, { component: "App", lot: selectedLot });
          showError(t('errors.calculation_failed'));
        }
      });

    // Cleanup: abort previous request when dependencies change
    return () => controller.abort();
  }, [baseAmount, competitorDiscount, myDiscount, techInputs, companyCerts, selectedLot, config, authLoading, isAuthenticated, setResults, showError, t]);

  // Simulation Effect (runs only when technical or economic results change) - with AbortController
  useEffect(() => {
    if (!config || !selectedLot || !results || authLoading || !isAuthenticated) return;

    // Additional guard: ensure we have valid data
    if (!config[selectedLot] || baseAmount <= 0) return;

    const controller = new AbortController();

    axios.post(`${API_URL}/simulate`, {
      lot_key: selectedLot,
      base_amount: baseAmount,
      competitor_discount: competitorDiscount,
      my_discount: myDiscount,
      current_tech_score: results.technical_score
    }, { signal: controller.signal })
      .then(res => setSimulationData(res.data))
      .catch(err => {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          logger.error("Simulation failed", err, { component: "App", lot: selectedLot });
          showError(t('errors.simulation_failed'));
        }
      });

    return () => controller.abort();
  }, [baseAmount, competitorDiscount, myDiscount, results?.technical_score, selectedLot, config, authLoading, isAuthenticated, results, setSimulationData, showError, t]);

  if (loading) return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 relative">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - responsive */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNavigate={setView}
          currentView={view}
        />
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
        {/* Demo mode banner */}
        {mockMode && (
          <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center">
            <span className="text-sm font-medium text-yellow-800">
              🎨 {t('app.demo_mode')}
            </span>
          </div>
        )}

        <header className="glass border-b border-white/60 p-4 shadow-sm z-30 sticky top-0 backdrop-blur-2xl">
          <div className="max-w-[1600px] mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4 md:gap-8">
              {/* Hamburger button - mobile only */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2.5 hover:bg-white/40 rounded-xl transition-all border border-transparent hover:border-white/60 active:scale-95"
                aria-label={t('app.toggle_menu')}
              >
                <Menu className="w-6 h-6 text-slate-600" />
              </button>

              <div className="flex items-center gap-4 md:gap-6">
                <div className="relative group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <img src="/poste-italiane-logo.svg" alt={t('app.poste_italiane_logo')} className="h-7 md:h-10 object-contain relative transition-transform duration-500 group-hover:scale-105" />
                </div>

                <div className="hidden md:block w-px h-8 bg-slate-200/60 shadow-[1px_0_0_rgba(255,255,255,0.8)]"></div>

                <div className="hidden md:flex flex-col">
                  <h1 className="text-xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tightest font-display leading-tight">
                    {t('app.title')}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-display">
                      {view === 'dashboard' ? t('common.home') : view === 'config' ? t('common.gara_lotto') : view === 'certs' ? t('common.certificates') : view === 'businessPlan' ? t('business_plan.title') : t('common.master_data')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">


              {/* Configurazioni Globali */}
              <button
                onClick={() => setView('master')}
                className={`hidden sm:flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-2xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest font-display border ${view === 'master' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-white/40 backdrop-blur-sm text-slate-600 border-white/60 hover:bg-white/70 hover:border-indigo-200 hover:text-indigo-600'}`}
                aria-label={t('common.master_data')}
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline">{t('common.master_data')}</span>
              </button>

              <div className="w-px h-7 bg-slate-200/60 mx-1 hidden md:block" />

              {/* Save */}
              <button
                onClick={handleUnifiedSave}
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-2xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest font-display bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                aria-label={t('common.save')}
              >
                <Save className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline">{t('common.save')}</span>
              </button>
              <LogoutButton />
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 overflow-auto flex flex-col min-h-0"
          >
            {view === 'config' ? (
              <ConfigPage
                onAddLot={async (lotName) => {
                  try {
                    await axios.post(`${API_URL}/config/add?lot_key=${encodeURIComponent(lotName)}`);
                    await refetchConfig();
                    setLot(lotName);
                    success(t('app.add_success', { name: lotName }));
                  } catch (err) {
                    logger.error("Failed to add lot", err, { component: "ConfigPage", lotName });
                    showError(t('app.add_error'));
                  }
                }}
                onDeleteLot={async (lotKey) => {
                  if (!window.confirm(t('app.delete_confirm', { name: lotKey }))) return;
                  try {
                    await axios.delete(`${API_URL}/config/${encodeURIComponent(lotKey)}`);

                    // Reset selected lot to trigger auto-select after refetch
                    if (selectedLot === lotKey) {
                      setLot(null);
                    }

                    await refetchConfig();
                    // Refresh will trigger auto-select of first available lot
                    setView('dashboard');
                    success(t('app.delete_success', { name: lotKey }));
                  } catch (err) {
                    logger.error("Failed to delete lot", err, { component: "ConfigPage", lotKey });
                    showError(t('app.delete_error'));
                  }
                }}
              />
            ) : view === 'master' ? (
              <MasterDataConfig />
            ) : view === 'certs' ? (
              <CertVerificationPage />
            ) : view === 'businessPlan' ? (
              <BusinessPlanProvider activeView={view}>
                <BusinessPlanPage />
              </BusinessPlanProvider>
            ) : (
              <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center">
                <div className="w-full max-w-[1600px]">
                  <TechEvaluator onNavigate={setView} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// Main App wrapper with authentication and context providers
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProtectedRoute>
          <ToastProvider>
            <ConfigProvider>
              <SimulationProvider>
                <AppContent />
              </SimulationProvider>
            </ConfigProvider>
          </ToastProvider>
        </ProtectedRoute>
      </AuthProvider>
    </ErrorBoundary>
  );
}
