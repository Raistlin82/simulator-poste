import { useState, useRef, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Brush, ReferenceDot } from 'recharts';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2 } from 'lucide-react';
import { formatNumber } from '../../../utils/formatters';

/**
 * SimulationChart - Display economic score simulation with current position and key points
 *
 * @param {Object} props
 * @param {Array} props.simulationData - Simulation data points
 * @param {Object} props.monteCarlo - Monte Carlo analysis results
 * @param {Object} props.results - Current calculation results
 * @param {number} props.myDiscount - Current discount percentage
 * @param {number} props.competitorDiscount - Competitor discount percentage
 */
export default function SimulationChart({ simulationData, monteCarlo, results, myDiscount, competitorDiscount }) {
  const { t } = useTranslation();
  const chartRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEconomic, setShowEconomic] = useState(true);
  const [showTotal, setShowTotal] = useState(false);  // Default OFF
  const [showLutech, setShowLutech] = useState(true);
  const [showCompetitor, setShowCompetitor] = useState(false);  // Default OFF

  // Listen for fullscreen changes - MUST be before early return
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleWebkitFullscreenChange = () => {
      setIsFullscreen(!!document.webkitFullscreenElement);
    };
    const handleMozFullscreenChange = () => {
      setIsFullscreen(!!document.mozFullScreenElement);
    };
    const handleMsFullscreenChange = () => {
      setIsFullscreen(!!document.msFullscreenElement);
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleWebkitFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleMozFullscreenChange);
      document.addEventListener('msfullscreenchange', handleMsFullscreenChange);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleWebkitFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleMozFullscreenChange);
        document.removeEventListener('msfullscreenchange', handleMsFullscreenChange);
      }
    };
  }, []);

  // Early return AFTER all hooks
  if (!simulationData || simulationData.length === 0) {
    return null;
  }

  // Calculate total score line (economic + current technical weighted)
  const chartData = simulationData.map(point => ({
    ...point,
    total_score: (point.economic_score || 0) + (results?.technical_score || 0)
  }));

  // Calculate 4 key points
  const competitorPoint = simulationData.find(p => Math.abs(p.discount - competitorDiscount) < 0.1);
  const competitorEconScore = competitorPoint?.economic_score || 0;
  const competitorTotalScore = monteCarlo?.competitor_threshold || competitorEconScore;

  const toggleFullscreen = () => {
    const element = chartRef.current;
    if (!element) return;

    if (!isFullscreen) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const chartHeight = isFullscreen ? window.innerHeight - 100 : 400;

  return (
    <div ref={chartRef} className={`bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 p-8 shadow-2xl shadow-blue-500/5 transition-all duration-500 hover:shadow-blue-500/10 ${isFullscreen ? 'fixed inset-0 z-50 flex flex-col !bg-white' : ''}`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest-plus font-display flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t('dashboard.bid_to_win')}
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 ml-4.5 font-display">Simulazione Sensibilità Sconto-Punteggio</p>
        </div>

        <div className="flex gap-2 md:gap-4 items-center flex-wrap w-full md:w-auto">
          {/* Line toggles */}
          <div className="flex gap-2 md:gap-3 bg-white/40 p-1.5 rounded-2xl border border-white/60 shadow-inner">
            <button
              onClick={() => setShowEconomic(!showEconomic)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest font-display ${showEconomic ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600'}`}
              aria-label="Mostra punteggio economico"
            >
              <div className={`w-2 h-2 rounded-full ${showEconomic ? 'bg-white' : 'bg-emerald-500'}`}></div>
              <span className="hidden sm:inline">Economia</span>
            </button>
            <button
              onClick={() => setShowTotal(!showTotal)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest font-display ${showTotal ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-600'}`}
              aria-label="Mostra punteggio totale"
            >
              <div className={`w-2 h-2 rounded-full ${showTotal ? 'bg-white' : 'bg-indigo-500'}`}></div>
              <span className="hidden sm:inline">Totale</span>
            </button>
          </div>

          {/* Point toggles */}
          <div className="flex gap-2 md:gap-3 bg-white/40 p-1.5 rounded-2xl border border-white/60 shadow-inner">
            <button
              onClick={() => setShowCompetitor(!showCompetitor)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest font-display ${showCompetitor ? 'bg-slate-800 text-white shadow-lg shadow-slate-900/20' : 'text-slate-400 hover:text-slate-600'}`}
              aria-label="Mostra competitor"
            >
              <div className={`w-2 h-2 rounded-full ${showCompetitor ? 'bg-white' : 'bg-black'}`}></div>
              <span className="hidden sm:inline">Target</span>
            </button>
            <button
              onClick={() => setShowLutech(!showLutech)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest font-display ${showLutech ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:text-slate-600'}`}
              aria-label="Mostra LUTECH"
            >
              <div className={`w-2 h-2 rounded-full ${showLutech ? 'bg-white' : 'bg-rose-500'}`}></div>
              <span className="hidden sm:inline">Lutech</span>
            </button>
          </div>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-white/60 border border-white/60 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all shadow-sm"
            title={isFullscreen ? "Esci da fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className={`w-full ${isFullscreen ? 'flex-1' : ''}`} style={{ height: isFullscreen ? chartHeight : '450px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 40, left: 10, bottom: 60 }}>
            <defs>
              <linearGradient id="colorEconomic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />

            <XAxis
              dataKey="discount"
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700, fontFamily: 'Inter' }}
              ticks={chartData.filter((_, i) => i % 5 === 0).map(d => d.discount)}
              label={{
                value: 'Sconto Gara (%)',
                position: 'insideBottom',
                offset: -40,
                fontSize: 10,
                fill: '#94a3b8',
                fontWeight: 900,
                fontFamily: 'Sora',
                textAnchor: 'middle'
              }}
              tickLine={false}
              axisLine={false}
              dy={10}
            />

            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700, fontFamily: 'Inter' }}
              label={{
                value: 'Punteggio Totale',
                angle: -90,
                position: 'insideLeft',
                fontSize: 10,
                fill: '#94a3b8',
                fontWeight: 900,
                fontFamily: 'Sora',
                offset: 10
              }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white/90 backdrop-blur-xl border border-white p-4 rounded-2xl shadow-2xl shadow-slate-900/10">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-display">Sconto: {label}%</div>
                      <div className="space-y-1.5">
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.stroke }} />
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight font-display">{p.name === 'economic_score' ? 'ECON' : 'TOT'}</span>
                            </div>
                            <span className="text-sm font-black text-slate-900 font-display">{p.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Brush
              dataKey="discount"
              height={20}
              stroke="#6366f1"
              fill="#f1f5f9"
              travellerWidth={8}
              y={20}
              strokeOpacity={0.3}
            />

            {showEconomic && (
              <Area
                type="monotone"
                dataKey="economic_score"
                stroke="#10b981"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorEconomic)"
                name="economic_score"
                animationDuration={1500}
              />
            )}

            {showTotal && (
              <Area
                type="monotone"
                dataKey="total_score"
                stroke="#6366f1"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorTotal)"
                name="total_score"
                animationDuration={1500}
              />
            )}

            {showCompetitor && (
              <>
                <ReferenceDot
                  x={competitorDiscount}
                  y={competitorEconScore}
                  r={10}
                  fill="#000000"
                  stroke="#ffffff"
                  strokeWidth={4}
                  className="drop-shadow-lg"
                />
                <ReferenceLine
                  y={competitorEconScore}
                  stroke="#000000"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  opacity={0.3}
                />
              </>
            )}

            {showLutech && results && (
              <>
                <ReferenceDot
                  x={myDiscount}
                  y={results.economic_score}
                  r={10}
                  fill="#f43f5e"
                  stroke="#ffffff"
                  strokeWidth={4}
                  className="drop-shadow-lg"
                />
                <ReferenceLine
                  y={results.economic_score}
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  opacity={0.3}
                />
              </>
            )}

            {monteCarlo?.optimal_discount && (
              <ReferenceLine
                x={monteCarlo.optimal_discount}
                stroke="#10b981"
                strokeWidth={3}
                strokeDasharray="6 6"
                label={{
                  position: 'top',
                  value: 'TARGET OPTIMAL',
                  fill: '#10b981',
                  fontSize: 10,
                  fontWeight: 900,
                  fontFamily: 'Sora',
                  offset: 20
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
