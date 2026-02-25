export const DAYS_PER_FTE = 220;
export const DEFAULT_DAILY_RATE = 250;

/**
 * Calcola il costo del Team Standard (Time-Aware, Month-by-Month)
 */
export const calculateTeamCost = (bp, lutechRates, lutechLabels, overrides = {}) => {
    if (!bp.team_composition || bp.team_composition.length === 0) {
        return { total: 0, byTow: {}, byLutechProfile: {}, teamMixRate: 0, intervals: [] };
    }

    const reusePct = overrides.reuse_factor ?? bp.reuse_factor ?? 0;
    const reuseFactor = 1 - (reusePct / 100);
    const durationMonths = bp.duration_months || 36;
    const daysPerFte = bp.days_per_fte || DAYS_PER_FTE;
    const defaultRate = bp.default_daily_rate || DEFAULT_DAILY_RATE;
    const inflationPct = bp.inflation_pct ?? 0;

    // Volume adjustments - use overrides if provided
    const volAdj = overrides.volume_adjustments ?? bp.volume_adjustments;
    const adjustmentPeriods = volAdj?.periods || [{
        month_start: 1,
        month_end: durationMonths,
        by_tow: volAdj?.by_tow || {},
        by_profile: volAdj?.by_profile || {},
    }];

    const getAdjustmentPeriodAtMonth = (month) => {
        for (const p of adjustmentPeriods) {
            if (month >= (p.month_start || 1) && month <= (p.month_end || durationMonths)) {
                return p;
            }
        }
        return adjustmentPeriods[0];
    };

    const getProfileFactorAtMonth = (profileId, month) => {
        for (const p of adjustmentPeriods) {
            if (month >= (p.month_start || 1) && month <= (p.month_end || durationMonths)) {
                return p.by_profile?.[profileId] ?? 1.0;
            }
        }
        return 1.0;
    };

    const getProfileRateAtMonth = (profileId, month) => {
        const mapping = bp.profile_mappings?.[profileId] || [];
        for (const periodMapping of mapping) {
            if (month >= (periodMapping.month_start || 1) && month <= (periodMapping.month_end || durationMonths)) {
                const mix = periodMapping.mix || [];
                let periodRate = 0;
                let periodPct = 0;
                for (const m of mix) {
                    const rate = lutechRates[m.lutech_profile] || defaultRate;
                    const pct = (m.pct || 0) / 100;
                    periodRate += rate * pct;
                    periodPct += pct;
                }
                return periodPct > 0 ? periodRate / periodPct : defaultRate;
            }
        }
        return defaultRate;
    };

    const getLutechMixAtMonth = (profileId, month) => {
        const mapping = bp.profile_mappings?.[profileId] || [];
        for (const periodMapping of mapping) {
            if (month >= (periodMapping.month_start || 1) && month <= (periodMapping.month_end || durationMonths)) {
                return periodMapping.mix || [];
            }
        }
        return null;
    };

    let totalCost = 0;
    const byTow = {};
    const byLutechProfile = {};
    const intervals = [];
    let totalDays = 0;

    const towMap = (bp.tows || []).reduce((acc, t) => ({ ...acc, [t.tow_id || t.id]: t.label || t.tow_name }), {});

    for (const member of bp.team_composition) {
        const profileId = member.profile_id || member.label;
        const fte = parseFloat(member.fte) || 0;
        const mapping = bp.profile_mappings?.[profileId] || [];

        const boundaries = new Set([1, durationMonths + 1]);
        for (const p of adjustmentPeriods) {
            boundaries.add(p.month_start || 1);
            boundaries.add((p.month_end || durationMonths) + 1);
        }
        for (const pm of mapping) {
            boundaries.add(pm.month_start || 1);
            boundaries.add((pm.month_end || durationMonths) + 1);
        }
        const sorted = Array.from(boundaries).filter(b => b >= 1 && b <= durationMonths + 1).sort((a, b) => a - b);

        const triplets = [];

        for (let i = 0; i < sorted.length - 1; i++) {
            const start = sorted[i];
            const end = sorted[i + 1] - 1;
            const months = sorted[i + 1] - sorted[i];
            const years = months / 12;

            const factor = getProfileFactorAtMonth(profileId, start);
            const rate = getProfileRateAtMonth(profileId, start);
            const mix = getLutechMixAtMonth(profileId, start);

            const yearIndex = Math.floor((start - 1) / 12);
            const inflationFactor = inflationPct > 0 ? Math.round(Math.pow(1 + inflationPct / 100, yearIndex) * 1e8) / 1e8 : 1;
            const escalatedRate = rate * inflationFactor;

            const adjustmentPeriod = getAdjustmentPeriodAtMonth(start);
            const towAllocation = member.tow_allocation || {};
            let towFactorSum = 0;
            let totalAllocatedPct = 0;
            for (const [towId, pct] of Object.entries(towAllocation)) {
                const towPct = parseFloat(pct) || 0;
                if (towPct > 0) {
                    const tFactor = adjustmentPeriod.by_tow?.[towId] ?? 1.0;
                    towFactorSum += (towPct / 100) * tFactor;
                    totalAllocatedPct += (towPct / 100);
                }
            }
            const finalTowFactor = totalAllocatedPct > 0 ? (towFactorSum / totalAllocatedPct) : 1.0;

            const intervalRawDays = fte * daysPerFte * years;
            const intervalBaseDays = intervalRawDays * factor;
            const intervalDays = intervalBaseDays * (reuseFactor * finalTowFactor);
            const intervalCost = intervalDays * escalatedRate;

            intervals.push({
                member: member.label,
                start_month: start,
                end_month: end,
                fte_base: fte,
                fte_factor: factor * reuseFactor * finalTowFactor,
                rate: escalatedRate,
                cost: intervalCost,
                days: intervalDays
            });

            if (mix && mix.length > 0) {
                for (const m of mix) {
                    if (!m.lutech_profile) continue;
                    const pct = (m.pct || 0) / 100;
                    const lRate = (lutechRates[m.lutech_profile] || defaultRate) * inflationFactor;

                    const lDaysRaw = intervalRawDays * pct;
                    const lDaysBase = intervalBaseDays * pct;
                    const lDaysEff = Math.round(intervalDays * pct * 100) / 100;
                    const lCost = lDaysEff * lRate;

                    if (!byLutechProfile[m.lutech_profile]) {
                        const info = lutechLabels[m.lutech_profile];
                        const parts = m.lutech_profile.split(':');
                        byLutechProfile[m.lutech_profile] = {
                            label: info?.profile || (parts.length > 1 ? parts[1] : m.lutech_profile),
                            practice: info?.practice || (parts[0] || ''),
                            cost: 0, days: 0, daysBase: 0, daysRaw: 0, rate: lRate, contributions: []
                        };
                    }
                    byLutechProfile[m.lutech_profile].cost += lCost;
                    byLutechProfile[m.lutech_profile].days += lDaysEff;
                    byLutechProfile[m.lutech_profile].daysBase += lDaysBase;
                    byLutechProfile[m.lutech_profile].daysRaw += lDaysRaw;
                    byLutechProfile[m.lutech_profile].contributions.push({
                        memberLabel: member.label, months: `${start}-${end}`,
                        days: lDaysEff, daysBase: lDaysBase, daysRaw: lDaysRaw,
                        rate: lRate, cost: lCost, profileFactor: factor, efficiencyFactor: reuseFactor * finalTowFactor,
                        reductions: {
                            tow: finalTowFactor < 1 ? (1 - finalTowFactor) * 100 : 0, reuse: reuseFactor < 1 ? (1 - reuseFactor) * 100 : 0, profile: factor < 1 ? (1 - factor) * 100 : 0,
                        }
                    });

                    triplets.push({
                        member: member.label, lutech_profile: m.lutech_profile, daysRaw: lDaysRaw, daysBase: lDaysBase, daysEff: lDaysEff,
                        cost: lCost, rate: lRate, factor, reuseFactor, finalTowFactor, start, end
                    });
                }
            } else {
                const defaultKey = '__default__';
                const defaultLRate = defaultRate;
                const lDaysRaw = intervalRawDays;
                const lDaysBase = intervalBaseDays;
                const lDaysEff = Math.round(intervalDays * 100) / 100;
                const lCost = lDaysEff * defaultLRate;

                if (!byLutechProfile[defaultKey]) {
                    byLutechProfile[defaultKey] = {
                        label: 'Non mappato', practice: '',
                        cost: 0, days: 0, daysBase: 0, daysRaw: 0, rate: defaultLRate, contributions: []
                    };
                }
                byLutechProfile[defaultKey].cost += lCost;
                byLutechProfile[defaultKey].days += lDaysEff;
                byLutechProfile[defaultKey].daysBase += lDaysBase;
                byLutechProfile[defaultKey].daysRaw += lDaysRaw;
                byLutechProfile[defaultKey].contributions.push({
                    memberLabel: member.label, months: `${start}-${end}`,
                    days: lDaysEff, daysBase: lDaysBase, daysRaw: lDaysRaw,
                    profileFactor: factor, efficiencyFactor: reuseFactor * finalTowFactor, rate: defaultLRate, cost: lCost,
                    reductions: { tow: finalTowFactor < 1 ? (1 - finalTowFactor) * 100 : 0, reuse: reuseFactor < 1 ? (1 - reuseFactor) * 100 : 0, profile: factor < 1 ? (1 - factor) * 100 : 0 }
                });

                triplets.push({ member: member.label, lutech_profile: defaultKey, daysRaw: lDaysRaw, daysBase: lDaysBase, daysEff: lDaysEff, cost: lCost, rate: defaultLRate, factor, reuseFactor, finalTowFactor, start, end });
            }
        }

        const towAllocation = member.tow_allocation || {};
        const allocatedPcts = Object.entries(towAllocation).filter(([, pct]) => (parseFloat(pct) || 0) > 0);
        const sumAllocatedPcts = allocatedPcts.reduce((sum, [, pct]) => sum + (parseFloat(pct) || 0), 0);
        const activeAllocations = sumAllocatedPcts > 0 ? allocatedPcts : [['__no_tow__', 100]];
        const finalSum = sumAllocatedPcts > 0 ? sumAllocatedPcts : 100;

        for (const [towId, pct] of activeAllocations) {
            const ratio = (parseFloat(pct) || 0) / finalSum;
            if (!byTow[towId]) byTow[towId] = { cost: 0, days: 0, daysBase: 0, daysRaw: 0, label: towMap[towId] || towId, contributions: [] };

            for (const t of triplets) {
                const tRaw = t.daysRaw * ratio;
                const tBase = t.daysBase * ratio;
                const tEff = Math.round(t.daysEff * ratio * 100) / 100;
                const tCost = tEff * t.rate;

                byTow[towId].cost += tCost;
                byTow[towId].days += tEff;
                byTow[towId].daysBase += tBase;
                byTow[towId].daysRaw += tRaw;
                byTow[towId].contributions.push({
                    memberLabel: t.member, profileLabel: byLutechProfile[t.lutech_profile]?.label || t.lutech_profile,
                    months: `${t.start}-${t.end}`, days: tEff, daysBase: tBase, daysRaw: tRaw, cost: tCost, rate: t.rate,
                    allocationPct: parseFloat(pct) || 0, profileFactor: t.factor, efficiencyFactor: t.reuseFactor * t.finalTowFactor,
                    reductions: { tow: t.finalTowFactor < 1 ? (1 - t.finalTowFactor) * 100 : 0, reuse: t.reuseFactor < 1 ? (1 - t.reuseFactor) * 100 : 0, profile: t.factor < 1 ? (1 - t.factor) * 100 : 0 }
                });
                totalCost += tCost;
                totalDays += tEff;
            }
        }
    }

    for (const towId of Object.keys(byTow)) {
        byTow[towId].cost = Math.round(byTow[towId].cost * 100) / 100;
        byTow[towId].days = Math.round(byTow[towId].days * 10000) / 10000;
        byTow[towId].daysBase = Math.round(byTow[towId].daysBase * 10000) / 10000;
        byTow[towId].daysRaw = Math.round(byTow[towId].daysRaw * 10000) / 10000;
    }
    for (const key of Object.keys(byLutechProfile)) {
        byLutechProfile[key].cost = Math.round(byLutechProfile[key].cost * 100) / 100;
        byLutechProfile[key].days = Math.round(byLutechProfile[key].days * 10000) / 10000;
        byLutechProfile[key].daysBase = Math.round(byLutechProfile[key].daysBase * 10000) / 10000;
        byLutechProfile[key].daysRaw = Math.round(byLutechProfile[key].daysRaw * 10000) / 10000;
    }

    return {
        total: Math.round(totalCost * 100) / 100,
        byTow,
        byLutechProfile,
        teamMixRate: totalDays > 0 ? (totalCost / totalDays) : 0,
        intervals
    };
};

/**
 * Calcola costo Governance
 */
export const calculateGovernanceCost = (bp, lutechRates, teamCost) => {
    const mode = bp.governance_mode || 'percentage';
    const durationMonths = bp.duration_months || 36;
    const durationYears = durationMonths / 12;
    const daysPerFte = bp.days_per_fte || DAYS_PER_FTE;
    const inflationPct = bp.inflation_pct ?? 0;

    let baseCost = 0;
    let meta = {};

    if (mode === 'manual') {
        const val = bp.governance_cost_manual;
        if (val !== null && val !== undefined) {
            baseCost = parseFloat(val);
            meta = { method: 'manuale' };
        }
    } else if (mode === 'fte' && (bp.governance_fte_periods || []).length > 0) {
        let totalCost = 0;
        for (const period of bp.governance_fte_periods) {
            const periodFte = parseFloat(period.fte) || 0;
            const periodMonths = (period.month_end || durationMonths) - (period.month_start || 1) + 1;
            const periodYears = periodMonths / 12;
            const mix = period.team_mix || [];

            let periodAvgRate = 0;
            let totalPct = 0;
            for (const item of mix) {
                const rate = lutechRates[item.lutech_profile] || 0;
                const pct = (item.pct || 0) / 100;
                totalPct += pct;
                periodAvgRate += rate * pct;
            }
            if (totalPct > 0) periodAvgRate = periodAvgRate / totalPct;

            const periodYearIndex = Math.floor(((period.month_start || 1) - 1) / 12);
            const periodInflationFactor = inflationPct > 0 ? Math.round(Math.pow(1 + inflationPct / 100, periodYearIndex) * 1e8) / 1e8 : 1;
            totalCost += periodFte * (periodAvgRate || 0) * periodInflationFactor * daysPerFte * periodYears;
        }
        baseCost = totalCost;
        meta = { method: 'fte', periods: bp.governance_fte_periods.length };
    } else if (mode === 'team_mix') {
        const totalFte = (bp.team_composition || []).reduce((sum, m) => sum + (parseFloat(m.fte) || 0), 0);
        const governanceFte = totalFte * ((bp.governance_pct || 0) / 100);
        const govMix = bp.governance_profile_mix || [];

        if (govMix.length > 0) {
            let totalPct = 0;
            let weightedRate = 0;
            for (const item of govMix) {
                const rate = lutechRates[item.lutech_profile] || 0;
                const pct = (item.pct || 0) / 100;
                totalPct += pct;
                weightedRate += rate * pct;
            }
            if (totalPct > 0) {
                const avgRate = weightedRate / totalPct;
                if (inflationPct > 0) {
                    let inflatedCost = 0;
                    const totalYears = Math.ceil(durationMonths / 12);
                    for (let yr = 0; yr < totalYears; yr++) {
                        const yrStartMonth = yr * 12 + 1;
                        const yrEndMonth = Math.min((yr + 1) * 12, durationMonths);
                        const yrFraction = (yrEndMonth - yrStartMonth + 1) / 12;
                        const yrInflationFactor = Math.round(Math.pow(1 + inflationPct / 100, yr) * 1e8) / 1e8;
                        inflatedCost += governanceFte * daysPerFte * yrFraction * avgRate * yrInflationFactor;
                    }
                    baseCost = inflatedCost;
                } else {
                    baseCost = governanceFte * daysPerFte * durationYears * avgRate;
                }
                meta = { method: 'mix_profili', fte: governanceFte, daysPerFte, years: durationYears, avgRate };
            }
        }
    }

    if (baseCost === 0 && Object.keys(meta).length === 0) {
        baseCost = teamCost * ((bp.governance_pct || 0) / 100);
        meta = { method: 'percentuale_team', pct: bp.governance_pct };
    }

    let finalCost = baseCost;
    if (bp.governance_apply_reuse && (bp.reuse_factor || 0) > 0) {
        const reuseFactor = (bp.reuse_factor || 0) / 100;
        finalCost = baseCost * (1 - reuseFactor);
        meta.reuse_applied = true;
        meta.reuse_factor = bp.reuse_factor;
        meta.base_cost = baseCost;
    }

    return { value: Math.round(finalCost * 100) / 100, meta };
};

/**
 * Calcola i Costi a Catalogo (Margin-First)
 */
export const calculateCatalogCost = (bp, lutechRates) => {
    const durationMonths = bp.duration_months || 36;
    const durationYears = durationMonths / 12;
    const daysPerFte = bp.days_per_fte || DAYS_PER_FTE;
    const defaultRate = bp.default_daily_rate || DEFAULT_DAILY_RATE;
    const inflationPct = bp.inflation_pct ?? 0;

    const tows = bp.tows || bp.tow_config || [];
    const catalogTows = tows.filter(t => t.type === 'catalogo');

    let total = 0;
    const byTow = [];

    const computeRate = (mixArr) => {
        if (!mixArr || mixArr.length === 0) return defaultRate;
        let totalWeighted = 0;
        let totalPctSum = 0;
        for (const m of mixArr) {
            const pct = (m.pct || 0) / 100;
            const entryRate = lutechRates[m.lutech_profile] || defaultRate;
            totalWeighted += pct * entryRate;
            totalPctSum += pct;
        }
        return totalPctSum > 0 ? totalWeighted / totalPctSum : defaultRate;
    };

    for (const tow of catalogTows) {
        const refTotalFte = parseFloat(tow.total_fte ?? 0);
        const totalCatalogValue = parseFloat(tow.total_catalog_value ?? 0);
        const defaultTargetMarginPct = parseFloat(tow.target_margin_pct ?? 20);
        const defaultCatalogReuseFactor = parseFloat(tow.catalog_reuse_factor ?? 0);
        const groups = tow.catalog_groups || [];

        const itemGroupMap = {};
        for (const g of groups) {
            for (const id of (g.item_ids || [])) itemGroupMap[id] = g;
        }

        let towCost = 0, towSellPrice = 0;
        const itemsDetail = [];

        for (const item of (tow.catalog_items || [])) {
            const group = itemGroupMap[item.id];
            const group_target = group ? (parseFloat(group.target_value) || 0) : 0;
            const group_fte = (totalCatalogValue > 0 && group_target > 0) ? (group_target / totalCatalogValue) * refTotalFte : 0;
            const group_reuse_raw = group?.reuse_factor;
            const group_reuse_factor = (group_reuse_raw !== null && group_reuse_raw !== undefined) ? parseFloat(group_reuse_raw) : defaultCatalogReuseFactor;
            const effective_group_fte = group_fte * (1.0 - group_reuse_factor);

            const item_pct = parseFloat(item.group_pct) || 0;
            const item_fte = effective_group_fte * item_pct / 100;

            const rate = computeRate(item.profile_mix);

            // Catalogo: NESSUNA inflazione applicata come da specifica
            // (l'inflazione si applica solo al team standard)
            const item_cost = item_fte * rate * durationYears * daysPerFte;

            const isDefaultMargin = item.target_margin_pct === null || item.target_margin_pct === undefined;
            const effectiveMarginPct = isDefaultMargin ? defaultTargetMarginPct : parseFloat(item.target_margin_pct);
            const marginFactor = 1 - effectiveMarginPct / 100;

            const item_sell_price = marginFactor > 0.001 ? item_cost / marginFactor : item_cost;

            const priceBase = parseFloat(item.price_base) || 0;
            const scontoGaraPct = parseFloat(tow.sconto_gara_pct ?? 0);
            const scontoGaraFactor = 1 - scontoGaraPct / 100;
            const effective_price_base = priceBase * scontoGaraFactor;
            const effective_group_target = group_target * scontoGaraFactor;

            const item_poste_total = effective_group_target * item_pct / 100;
            const item_lutech_unit = (item_poste_total > 0 && effective_price_base > 0) ? (item_sell_price / item_poste_total) * effective_price_base : 0;
            const item_sconto_pct = (effective_price_base > 0 && item_lutech_unit > 0) ? (1 - item_lutech_unit / effective_price_base) * 100 : 0;

            towCost += item_cost;
            towSellPrice += item_sell_price;
            itemsDetail.push({
                label: item.label || '', tipo: item.tipo, complessita: item.complessita, price_base: priceBase,
                group_pct: item_pct, poste_total: Math.round(item_poste_total),
                lutech_cost: Math.round(item_cost), lutech_revenue: Math.round(item_sell_price), lutech_margin: Math.round(item_sell_price - item_cost),
                effective_margin_pct: effectiveMarginPct, fte: Math.round(item_fte * 100) / 100, lutech_unit_price: Math.round(item_lutech_unit * 100) / 100, sconto_pct: Math.round(item_sconto_pct * 100) / 100,
            });
        }

        // Cluster distribution pesata su FTE
        const clusters = tow.catalog_clusters || [];
        const clusterDetail = [];
        let distribution = null;
        if (clusters.length > 0) {
            distribution = {};
            const profileToCluster = {};
            for (const c of clusters) {
                for (const p of (c.poste_profiles || [])) profileToCluster[p] = c.id;
            }
            const clusterAccum = {};
            for (const c of clusters) clusterAccum[c.id] = 0;
            const totalFteItems = itemsDetail.reduce((s, it) => s + it.fte, 0);

            if (totalFteItems > 0) {
                (tow.catalog_items || []).forEach((item, i) => {
                    const weight = itemsDetail[i].fte / totalFteItems;
                    for (const entry of (item.profile_mix || [])) {
                        const cid = profileToCluster[entry.poste_profile];
                        if (cid !== undefined) {
                            clusterAccum[cid] = (clusterAccum[cid] || 0) + weight * (parseFloat(entry.pct) || 0);
                        }
                    }
                });
            }

            for (const c of clusters) {
                const actualPct = clusterAccum[c.id] || 0;
                const requiredPct = parseFloat(c.required_pct) || 0;
                const constraintType = c.constraint_type || 'equality';

                let ok;
                if (constraintType === 'maximum') ok = actualPct <= requiredPct;
                else if (constraintType === 'minimum') ok = actualPct >= requiredPct;
                else ok = Math.abs(actualPct - requiredPct) <= 2;

                clusterDetail.push({
                    label: c.label,
                    required_pct: requiredPct,
                    constraint_type: constraintType,
                    actual_pct: Math.round(actualPct * 10) / 10,
                    ok,
                });

                // Distribution value
                let totalClusterFte = 0;
                clusters.forEach(c2 => totalClusterFte += parseFloat(c2.valore) || 0);
                if (totalClusterFte > 0) {
                    const w = (parseFloat(c.valore) || 0) / totalClusterFte;
                    distribution[c.nome] = {
                        weight: w,
                        allocated_cost: towCost * w,
                        allocated_revenue: towSellPrice * w,
                        allocated_margin: (towSellPrice - towCost) * w
                    };
                }
            }
        }

        // Groups totals
        const groupsDetail = groups.map(g => {
            const gItemIdxs = (tow.catalog_items || []).reduce((arr, it, i) => {
                if ((g.item_ids || []).includes(it.id)) arr.push(i);
                return arr;
            }, []);
            const gItems = gItemIdxs.map(i => itemsDetail[i]).filter(Boolean);
            return {
                label: g.label || '',
                target_value: parseFloat(g.target_value) || 0,
                lutech_cost: gItems.reduce((s, it) => s + it.lutech_cost, 0),
                lutech_revenue: gItems.reduce((s, it) => s + it.lutech_revenue, 0),
                lutech_margin: gItems.reduce((s, it) => s + it.lutech_margin, 0),
                fte: gItems.reduce((s, it) => s + it.fte, 0),
            };
        });

        total += towCost;
        byTow.push({
            tow_id: tow.tow_id || tow.id,
            label: tow.label || tow.tow_name,
            cost: towCost,
            sell_price: towSellPrice,
            margin: towSellPrice - towCost,
            margin_pct: towSellPrice > 0 ? (towSellPrice - towCost) / towSellPrice * 100 : 0,
            items: itemsDetail,
            groups: groupsDetail,
            clusters: clusterDetail,
            cluster_distribution: distribution
        });
    }

    return { total: Math.round(total * 100) / 100, detail: { byTow } };
};
