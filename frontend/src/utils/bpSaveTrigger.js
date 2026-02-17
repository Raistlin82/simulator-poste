/**
 * Shared BP save trigger singleton.
 * BusinessPlanPage sets `bpSaveTrigger.fn` when mounted.
 * App.jsx calls `bpSaveTrigger.fn?.()` from handleUnifiedSave.
 */
export const bpSaveTrigger = { fn: null };
