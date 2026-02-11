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
    <div ref={chartRef} className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 ${isFullscreen ? 'fixed inset-0 z-50 flex flex-col' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-slate-800">{t('dashboard.bid_to_win')}</h3>
        <div className="flex gap-2 md:gap-4 items-center flex-wrap">
          {/* Line toggles */}
          <div className="flex gap-2 md:gap-3 border-r pr-2 md:pr-4 border-slate-200">
            <button
              onClick={() => setShowEconomic(!showEconomic)}
              className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded transition-all ${showEconomic ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200 opacity-50'}`}
              aria-label="Mostra punteggio economico"
              aria-pressed={showEconomic}
            >
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="hidden sm:inline text-xs text-slate-700 font-bold uppercase tracking-tight">Economico</span>
            </button>
            <button
              onClick={() => setShowTotal(!showTotal)}
              className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded transition-all ${showTotal ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200 opacity-50'}`}
              aria-label="Mostra punteggio totale"
              aria-pressed={showTotal}
            >
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="hidden sm:inline text-xs text-slate-700 font-bold uppercase tracking-tight">Totale</span>
            </button>
          </div>

          {/* Point toggles */}
          <div className="flex gap-2 md:gap-3 border-r pr-2 md:pr-4 border-slate-200">
            <button
              onClick={() => setShowCompetitor(!showCompetitor)}
              className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded transition-all ${showCompetitor ? 'bg-slate-100 border border-slate-300' : 'bg-slate-50 border border-slate-200 opacity-50'}`}
              aria-label="Mostra competitor"
              aria-pressed={showCompetitor}
            >
              <div className="w-3 h-3 bg-black rounded-full"></div>
              <span className="hidden sm:inline text-xs text-slate-700 font-bold uppercase tracking-tight">Competitor</span>
            </button>
            <button
              onClick={() => setShowLutech(!showLutech)}
              className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded transition-all ${showLutech ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200 opacity-50'}`}
              aria-label="Mostra LUTECH"
              aria-pressed={showLutech}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="hidden sm:inline text-xs text-slate-700 font-bold uppercase tracking-tight">LUTECH</span>
            </button>
          </div>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="p-3 min-w-[44px] min-h-[44px] hover:bg-slate-100 rounded-lg transition-colors"
            title={isFullscreen ? "Esci da fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Esci da fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5 text-slate-600" /> : <Maximize2 className="w-5 h-5 text-slate-600" />}
          </button>
        </div>
      </div>

      <div className={`w-full ${isFullscreen ? 'flex-1' : ''}`} style={{ height: isFullscreen ? chartHeight : '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 100, left: 10, bottom: 60 }}>
            <defs>
              <linearGradient id="colorEconomic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="discount"
              tick={{ fontSize: 11, fill: '#475569' }}
              ticks={chartData.filter((_, i) => i % 5 === 0).map(d => d.discount)}
              label={{
                value: 'Sconto (%)',
                position: 'insideBottom',
                offset: -35,
                fontSize: 12,
                fill: '#1e293b',
                fontWeight: 600
              }}
              tickLine={{ stroke: '#cbd5e1' }}
              axisLine={{ stroke: '#cbd5e1' }}
            />

            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#475569' }}
              label={{
                value: 'Punteggio',
                angle: -90,
                position: 'insideLeft',
                fontSize: 12,
                fill: '#1e293b',
                fontWeight: 600,
                offset: 5
              }}
              tickLine={{ stroke: '#cbd5e1' }}
              axisLine={{ stroke: '#cbd5e1' }}
            />

            <Tooltip
              formatter={(value, name) => {
                if (name === 'economic_score') return [`${value.toFixed(2)} Punti`, 'Economico'];
                if (name === 'total_score') return [`${value.toFixed(2)} Punti`, 'Totale (Econ. + Tecn.)'];
                return [value, name];
              }}
              labelFormatter={(label) => `Sconto: ${label}%`}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '11px',
                backgroundColor: 'white'
              }}
            />

            {/* Brush for zoom functionality */}
            <Brush
              dataKey="discount"
              height={25}
              stroke="#3b82f6"
              fill="#eff6ff"
              travellerWidth={10}
              y={10}
            />

            {/* Economic score line (green) */}
            {showEconomic && (
              <Area
                type="monotone"
                dataKey="economic_score"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorEconomic)"
                name="Economico"
              />
            )}

            {/* Total score line (blue) */}
            {showTotal && (
              <Area
                type="monotone"
                dataKey="total_score"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTotal)"
                name="Totale (Econ. + Tecn.)"
              />
            )}

            {/* 4 Key Points as Reference Dots */}
            {/* 1. Competitor Economic Point (black) */}
            {showCompetitor && (
              <>
                <ReferenceDot
                  x={competitorDiscount}
                  y={competitorEconScore}
                  r={8}
                  fill="#000000"
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={{ value: 'Comp Econ', position: 'top', fontSize: 10, fill: '#000000' }}
                />
                {/* Competitor Economic horizontal line */}
                <ReferenceLine
                  y={competitorEconScore}
                  stroke="#000000"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  label={{ position: 'right', value: `${competitorEconScore.toFixed(1)}`, fill: '#000000', fontSize: 9 }}
                />
              </>
            )}

            {/* 2. Competitor Total Point (black) */}
            {showCompetitor && (
              <>
                <ReferenceDot
                  x={competitorDiscount}
                  y={competitorTotalScore}
                  r={8}
                  fill="#000000"
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={{ value: 'Comp Tot', position: 'top', fontSize: 10, fill: '#000000' }}
                />
                {/* Competitor Total horizontal line */}
                <ReferenceLine
                  y={competitorTotalScore}
                  stroke="#000000"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  label={{ position: 'right', value: `${competitorTotalScore.toFixed(1)}`, fill: '#000000', fontSize: 9 }}
                />
              </>
            )}

            {/* 3. LUTECH Economic Point (red) - Toggleable */}
            {showLutech && results && typeof results.economic_score === 'number' && (
              <>
                <ReferenceDot
                  x={myDiscount}
                  y={results.economic_score}
                  r={12}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth={4}
                  label={{
                    value: `LUTECH (${formatNumber(myDiscount, 1)}%)`,
                    position: 'top',
                    fontSize: 11,
                    fill: '#dc2626',
                    fontWeight: 'bold',
                    offset: 15
                  }}
                />
                {/* LUTECH Economic horizontal line */}
                <ReferenceLine
                  y={results.economic_score}
                  stroke="#dc2626"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  label={{ position: 'right', value: `${results.economic_score.toFixed(1)}`, fill: '#dc2626', fontSize: 9 }}
                />
              </>
            )}

            {/* 4. LUTECH Total Point (red) - Toggleable */}
            {showLutech && results && typeof results.total_score === 'number' && (
              <>
                <ReferenceDot
                  x={myDiscount}
                  y={results.total_score}
                  r={12}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth={4}
                  label={{
                    value: `LUTECH TOT (${formatNumber(myDiscount, 1)}%)`,
                    position: 'bottom',
                    fontSize: 11,
                    fill: '#dc2626',
                    fontWeight: 'bold',
                    offset: 15
                  }}
                />
                {/* LUTECH Total horizontal line */}
                <ReferenceLine
                  y={results.total_score}
                  stroke="#dc2626"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  label={{ position: 'right', value: `${results.total_score.toFixed(1)}`, fill: '#dc2626', fontSize: 9 }}
                />
              </>
            )}

            {/* Safe Zone Marker */}
            {monteCarlo?.optimal_discount && (
              <ReferenceLine
                x={monteCarlo.optimal_discount}
                stroke="#10b981"
                strokeWidth={1}
                strokeDasharray="3 3"
                label={{ position: 'top', value: 'Safe Zone', fill: '#10b981', fontSize: 9, fontWeight: 'bold' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
