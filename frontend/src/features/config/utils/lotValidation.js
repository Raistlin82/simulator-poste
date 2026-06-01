const VALID_REQ_TYPES = new Set(['resource', 'reference', 'project']);

const toNumber = (value) => Number.parseFloat(value) || 0;

export function validateLotConfig(lot, masterData = {}) {
  const issues = [];
  if (!lot) {
    return [{ severity: 'error', message: 'Nessun lotto selezionato.' }];
  }

  if (toNumber(lot.base_amount) <= 0) {
    issues.push({ severity: 'error', message: 'Base d’asta assente o non valida.' });
  }

  const companyCerts = lot.company_certs || [];
  const reqs = lot.reqs || [];
  if (companyCerts.length === 0) {
    issues.push({ severity: 'warning', message: 'Nessuna certificazione aziendale configurata.' });
  }
  if (reqs.length === 0) {
    issues.push({ severity: 'error', message: 'Nessun requisito tecnico configurato.' });
  }

  const certLabels = new Set();
  companyCerts.forEach((cert, index) => {
    const label = (cert.label || '').trim();
    if (!label) issues.push({ severity: 'error', message: `Certificazione aziendale #${index + 1} senza nome.` });
    if (label && certLabels.has(label.toLowerCase())) {
      issues.push({ severity: 'warning', message: `Certificazione aziendale duplicata: ${label}.` });
    }
    if (label) certLabels.add(label.toLowerCase());
    if (toNumber(cert.points) <= 0) {
      issues.push({ severity: 'warning', message: `Certificazione aziendale “${label || index + 1}” senza punteggio grezzo.` });
    }
  });

  const masterProfCerts = new Set((masterData.prof_certs || []).map((cert) => cert.toLowerCase()));
  const reqIds = new Set();
  reqs.forEach((req, index) => {
    const id = (req.id || '').trim();
    const label = (req.label || '').trim();
    const display = label || id || `#${index + 1}`;

    if (!id) issues.push({ severity: 'error', message: `Requisito ${display} senza identificativo.` });
    if (id && reqIds.has(id.toLowerCase())) {
      issues.push({ severity: 'error', message: `Identificativo requisito duplicato: ${id}.` });
    }
    if (id) reqIds.add(id.toLowerCase());
    if (!label) issues.push({ severity: 'warning', message: `Requisito ${id || index + 1} senza titolo descrittivo.` });
    if (!VALID_REQ_TYPES.has(req.type)) {
      issues.push({ severity: 'error', message: `Requisito ${display} con tipo non valido.` });
    }
    if (toNumber(req.max_points) <= 0) {
      issues.push({ severity: 'warning', message: `Requisito ${display} senza punteggio grezzo massimo.` });
    }
    if (toNumber(req.gara_weight) <= 0) {
      issues.push({ severity: 'warning', message: `Requisito ${display} senza peso gara.` });
    }
    if (req.type === 'resource') {
      const selectedCerts = req.selected_prof_certs || [];
      if (selectedCerts.length === 0) {
        issues.push({ severity: 'warning', message: `Requisito risorsa ${display} senza certificazioni professionali selezionate.` });
      }
      if (toNumber(req.prof_C) > toNumber(req.prof_R)) {
        issues.push({ severity: 'error', message: `Requisito ${display}: C non può superare R.` });
      }
      selectedCerts.forEach((cert) => {
        if (masterProfCerts.size > 0 && !masterProfCerts.has(cert.toLowerCase())) {
          issues.push({ severity: 'warning', message: `Certificazione “${cert}” non presente nei Master Data.` });
        }
      });
    }
  });

  const weightedTech = companyCerts.reduce((sum, cert) => sum + toNumber(cert.gara_weight), 0)
    + reqs.reduce((sum, req) => sum + toNumber(req.gara_weight), 0);
  if (lot.max_tech_score && Math.abs(weightedTech - toNumber(lot.max_tech_score)) > 0.05) {
    issues.push({
      severity: 'warning',
      message: `Somma pesi tecnici ${weightedTech.toFixed(2)} diversa dal massimo tecnico ${toNumber(lot.max_tech_score).toFixed(2)}.`
    });
  }
  if (weightedTech > 100) {
    issues.push({ severity: 'error', message: 'La somma dei pesi tecnici supera 100.' });
  }

  if (lot.rti_enabled) {
    const activeCompanies = ['Lutech', ...(lot.rti_companies || [])];
    const totalQuota = activeCompanies.reduce((sum, company) => sum + toNumber(lot.rti_quotas?.[company]), 0);
    if (Math.abs(totalQuota - 100) > 0.05) {
      issues.push({ severity: 'error', message: `Quote RTI non bilanciate: totale ${totalQuota.toFixed(2)}%.` });
    }
  }

  return issues;
}

export function buildLotReadiness({
  lot,
  masterData,
  techInputs = {},
  companyCerts = {},
  results,
  monteCarlo,
  businessPlanData
}) {
  const issues = validateLotConfig(lot, masterData);
  const hasErrors = issues.some((issue) => issue.severity === 'error');
  const hasWarnings = issues.some((issue) => issue.severity === 'warning');
  const hasEvaluationInput = Object.keys(techInputs || {}).length > 0
    || Object.values(companyCerts || {}).some((status) => status && status !== 'none');

  const steps = [
    {
      id: 'config',
      label: 'Configurazione',
      view: 'config',
      status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'complete',
      detail: hasErrors ? 'Da correggere' : hasWarnings ? 'Da rifinire' : 'Completa'
    },
    {
      id: 'evaluation',
      label: 'Valutazione',
      view: 'dashboard',
      status: results && hasEvaluationInput ? 'complete' : 'pending',
      detail: results && hasEvaluationInput ? 'Calcolata' : 'Input richiesti'
    },
    {
      id: 'analysis',
      label: 'Analisi',
      view: 'dashboard',
      status: results && monteCarlo ? 'complete' : 'pending',
      detail: results && monteCarlo ? 'Monte Carlo OK' : 'In attesa'
    },
    {
      id: 'businessPlan',
      label: 'Business Plan',
      view: 'businessPlan',
      status: businessPlanData?.totals ? 'complete' : 'pending',
      detail: businessPlanData?.totals ? 'Calcolato' : 'Da completare'
    }
  ];

  return {
    issues,
    steps,
    completedSteps: steps.filter((step) => step.status === 'complete').length,
    totalSteps: steps.length
  };
}
