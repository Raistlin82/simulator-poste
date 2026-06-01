import { createContext, useContext, useState, useReducer, useMemo, useCallback } from 'react';

const SimulationContext = createContext(null);
const VALID_CERT_STATUSES = new Set(['all', 'partial', 'none']);

// Reducer for complex state (techInputs, companyCerts)
// companyCerts: { [label]: "all" | "partial" | "none" }
const simulationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOT':
      return { ...state, selectedLot: action.payload };
    case 'SET_DISCOUNT': {
      const next = { ...state, [action.key]: action.value };

      // Sync: when myDiscount increases past competitorDiscount, drag it up
      if (action.key === 'myDiscount' &&
        state.myDiscount >= state.competitorDiscount &&
        action.value > state.myDiscount) {
        const delta = action.value - state.myDiscount;
        next.competitorDiscount = Math.min(state.competitorDiscount + delta, 100);
        if (state.competitorEconDiscount > next.competitorDiscount) {
          next.competitorEconDiscount = next.competitorDiscount;
        }
      }

      // Sync: clamp competitorEconDiscount when competitorDiscount decreases
      if (action.key === 'competitorDiscount' && state.competitorEconDiscount > action.value) {
        next.competitorEconDiscount = action.value;
      }

      return next;
    }
    case 'SET_COMPETITOR_PARAM':
      return { ...state, [action.key]: action.value };
    case 'SET_TECH_INPUT':
      return {
        ...state,
        techInputs: {
          ...state.techInputs,
          [action.reqId]: action.value
        }
      };
    case 'SET_COMPANY_CERT':
      if (!action.label || !VALID_CERT_STATUSES.has(action.status)) {
        return state;
      }
      return {
        ...state,
        companyCerts: {
          ...state.companyCerts,
          [action.label]: action.status  // "all", "partial", or "none"
        }
      };
    case 'RESET':
      return action.payload;
    default:
      return state;
  }
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};

export const SimulationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(simulationReducer, {
    selectedLot: null,
    myDiscount: 0.0,
    competitorDiscount: 30.0,
    competitorTechScore: 60.0,
    competitorEconDiscount: 30.0,
    techInputs: {},
    companyCerts: {}
  });

  const [results, setResults] = useState(null);
  const [simulationData, setSimulationData] = useState([]);
  const [monteCarlo, setMonteCarlo] = useState(null);
  const [businessPlanData, setBusinessPlanData] = useState(null);

  const setLot = useCallback((lotKey) => {
    dispatch({ type: 'SET_LOT', payload: lotKey });
    // Save to localStorage for restoration on next app load
    if (lotKey) {
      localStorage.setItem('lastSelectedLot', lotKey);
    } else {
      localStorage.removeItem('lastSelectedLot');
    }
  }, []);

  const setDiscount = useCallback((key, value) => {
    dispatch({ type: 'SET_DISCOUNT', key, value });
  }, []);

  const setCompetitorParam = useCallback((key, value) => {
    dispatch({ type: 'SET_COMPETITOR_PARAM', key, value });
  }, []);

  const setTechInput = useCallback((reqId, value) => {
    if (!reqId) return;
    dispatch({ type: 'SET_TECH_INPUT', reqId, value });
  }, []);

  const setCompanyCert = useCallback((label, status) => {
    if (!label || !VALID_CERT_STATUSES.has(status)) return;
    dispatch({ type: 'SET_COMPANY_CERT', label, status });  // status: "all", "partial", "none"
  }, []);

  const resetState = useCallback((newState) => {
    dispatch({ type: 'RESET', payload: newState });
  }, []);

  // Memoize context value to prevent unnecessary re-renders in consumers
  // when unrelated state changes (e.g. results update shouldn't recreate the whole value)
  const value = useMemo(() => ({
    ...state,
    results,
    simulationData,
    monteCarlo,
    businessPlanData,
    setLot,
    setDiscount,
    setCompetitorParam,
    setTechInput,
    setCompanyCert,
    resetState,
    setResults,
    setSimulationData,
    setMonteCarlo,
    setBusinessPlanData
  }), [
    state,
    results,
    simulationData,
    monteCarlo,
    businessPlanData,
    setLot,
    setDiscount,
    setCompetitorParam,
    setTechInput,
    setCompanyCert,
    resetState
  ]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};
