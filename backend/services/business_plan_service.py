"""
Business Plan Service
Calcoli di costo, margine e scenari per gare Poste.
"""

from typing import Dict, Any, List, Optional, TYPE_CHECKING
import logging

logger = logging.getLogger(__name__)


class BusinessPlanService:
    """
    Servizio di calcolo per il Business Plan.
    Implementa la formula a 5 step dal design document.
    """

    DAYS_PER_FTE = 220

    @staticmethod
    def apply_volume_adjustments(
        team_composition: List[Dict[str, Any]],
        volume_adjustments: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        STEP 1: Applica rettifiche volumi (global, per TOW, per profilo).
        
        Args:
            team_composition: Lista profili dal capitolato [{profile_id, label, fte, ...}]
            volume_adjustments: {"global": 0.90, "by_tow": {...}, "by_profile": {...}}
        
        Returns:
            Team composition con FTE rettificati
        """
        global_factor = volume_adjustments.get("global", 1.0)
        by_tow = volume_adjustments.get("by_tow", {})
        by_profile = volume_adjustments.get("by_profile", {})

        adjusted = []
        for member in team_composition:
            profile_id = member.get("profile_id", member.get("label", ""))
            fte = float(member.get("fte", 0))

            # Apply global factor
            fte_adj = fte * global_factor

            # Apply profile factor
            profile_factor = by_profile.get(profile_id, 1.0)
            fte_adj *= profile_factor

            # TOW-level adjustments would apply to tow_allocation
            # For now, handled at the aggregate level
            adjusted_member = {**member, "fte_adjusted": round(fte_adj, 4)}
            adjusted.append(adjusted_member)

        return adjusted

    @staticmethod
    def apply_reuse_factor(effort: float, reuse_factor: float) -> float:
        """
        STEP 2: Applica fattore riuso.
        
        Args:
            effort: FTE o GG dopo rettifica
            reuse_factor: 0.0 - 1.0 (percentuale di efficienza)
        
        Returns:
            Effort effettivo dopo riuso
        """
        return effort * (1 - reuse_factor)

    @staticmethod
    def _get_mix_for_year(profile_mapping: List[Dict[str, Any]], year: int) -> Optional[List[Dict[str, Any]]]:
        """
        Trova il mix di profili corretto per un dato anno da una mappatura time-varying.
        Supporta due formati:
        - Nuovo (TimeVaryingMix): [{"month_start": 1, "month_end": 12, "mix": [...]}]
        - Vecchio (label): [{"period": "Anno 1", "mix": [...]}]
        - Semplice (lista diretta): [{"lutech_profile": "...", "pct": ...}]
        """
        if not profile_mapping:
            return None

        first = profile_mapping[0]

        # Caso 1: Mapping semplice, non time-varying (lista diretta di profili)
        if "lutech_profile" in first:
            return profile_mapping

        # Caso 2: Formato nuovo con month_start/month_end (schema TimeVaryingMix)
        if "month_start" in first:
            year_start_month = (year - 1) * 12 + 1
            year_end_month = year * 12
            last_valid = None
            for item in profile_mapping:
                ms = item.get("month_start", 1)
                me = item.get("month_end", year_end_month)
                if ms <= year_end_month and me >= year_start_month:
                    return item.get("mix")
                if ms <= year_start_month:
                    last_valid = item.get("mix")
            return last_valid

        # Caso 3: Formato vecchio con label "Anno X" / "Anno X+"
        best_match = None
        for item in profile_mapping:
            period_label = item.get("period", "").strip()
            if period_label == f"Anno {year}":
                return item.get("mix")
            if period_label.endswith("+"):
                try:
                    start_year = int(period_label.replace("Anno", "").replace("+", "").strip())
                    if year >= start_year:
                        best_match = item.get("mix")
                except ValueError:
                    continue

        return best_match


    @staticmethod
    def calculate_team_cost(
        team_composition: List[Dict[str, Any]],
        volume_adjustments: Dict[str, Any],
        reuse_factor: float,
        profile_mappings: Dict[str, List[Dict[str, Any]]],
        profile_rates: Dict[str, float],
        duration_months: int,
        default_daily_rate: float = 250.0,
        inflation_pct: float = 0.0,
        days_per_fte: int = 220,
    ) -> Dict[str, Any]:
        """
        Calcola il costo del team basato su un motore ad intervalli mensili (alta precisione).
        Identifica tutti i punti di variazione (rettifica volumi, mix profili) e calcola per ogni intervallo.
        """
        if not duration_months or duration_months <= 0:
            raise ValueError("La durata del contratto (duration_months) deve essere positiva.")

        result = {
            "total_fte_original": 0.0,
            "total_fte_adjusted": 0.0,
            "total_days": 0.0,
            "total_days_base": 0.0, # NEW
            "total_cost": 0.0,
            "by_profile": {},
            "by_tow": {}, # {id: {cost, label, days, days_base, contributions: []}}
            "by_lutech_profile": {},  # {id: {label, cost, days, days_base, contributions: []}}
            "intervals": [], # Detailed time-slices for traceability
        }

        # 1. Trova tutte le boundary temporali (mesi di inizio)
        boundaries = {1, duration_months + 1}
        
        # Da rettifica volumi
        vol_periods = volume_adjustments.get("periods") or []
        for p in vol_periods:
            boundaries.add(p.get("month_start", 1))
            boundaries.add(p.get("month_end", duration_months) + 1)
            
        # Da mapping profili
        for profile_id, mappings in profile_mappings.items():
            for m in mappings:
                if isinstance(m, dict):
                    boundaries.add(m.get("month_start", 1))
                    boundaries.add(m.get("month_end", duration_months) + 1)
                else: # Pydantic object
                    boundaries.add(getattr(m, "month_start", 1))
                    boundaries.add(getattr(m, "month_end", duration_months) + 1)

        sorted_boundaries = sorted([b for b in boundaries if 1 <= b <= duration_months + 1])
        
        # 2. Helper per trovare i parametri in un dato mese
        def get_adj_period_at(month):
            for p in vol_periods:
                if p.get("month_start", 1) <= month <= p.get("month_end", duration_months):
                    return p
            return {"month_start": 1, "month_end": duration_months, "by_profile": {}, "by_tow": {}}

        def get_mapping_at(poste_profile_id, month):
            mappings = profile_mappings.get(poste_profile_id, [])
            for m in mappings:
                m_start = m.get("month_start") if isinstance(m, dict) else getattr(m, "month_start")
                m_end = m.get("month_end") if isinstance(m, dict) else getattr(m, "month_end")
                if (m_start or 1) <= month <= (m_end or duration_months):
                    return m.get("mix") if isinstance(m, dict) else getattr(m, "mix")
            return None

        # 3. Iterazione per ogni membro del team
        reuse_multiplier = 1 - reuse_factor
        weighted_fte_sum_global = 0.0

        for member in team_composition:
            poste_profile_id = member.get("profile_id", member.get("label", "unknown"))
            member_label = member.get("label", poste_profile_id)
            fte_original = float(member.get("fte", 0))
            tow_alloc_input = member.get("tow_allocation") # Può essere lista o dict
            
            # Normalizza tow_allocation in dict {tow_id: pct}
            tow_allocation = {}
            if isinstance(tow_alloc_input, list):
                for t in tow_alloc_input:
                    tow_allocation[t.get("tow_id")] = float(t.get("pct", 0))
            elif isinstance(tow_alloc_input, dict):
                tow_allocation = {k: float(v) for k, v in tow_alloc_input.items()}

            member_total_cost = 0.0
            member_total_days = 0.0
            member_weighted_fte_sum = 0.0

            # 4. Iterazione per ogni intervallo temporale
            for i in range(len(sorted_boundaries) - 1):
                start = sorted_boundaries[i]
                next_boundary = sorted_boundaries[i+1]
                m_end = next_boundary - 1
                months_in_interval = next_boundary - start
                years_in_interval = months_in_interval / 12.0

                # Parametri attivabili
                adj_period = get_adj_period_at(start)
                p_factor = adj_period.get("by_profile", {}).get(poste_profile_id, 1.0)

                # YoY inflation: year 0 = no change, year 1 = +inflation_pct%, etc.
                year_index = (start - 1) // 12
                inflation_factor = (1 + inflation_pct / 100) ** year_index if inflation_pct > 0 else 1.0
                
                # Calcolo TOW factor per questo membro in questo intervallo
                tow_factor = 1.0
                total_alloc = sum(tow_allocation.values())
                if total_alloc > 0:
                    weighted_sum = 0.0
                    for tow_id, pct in tow_allocation.items():
                        t_factor = adj_period.get("by_tow", {}).get(tow_id, 1.0)
                        weighted_sum += (pct / total_alloc) * t_factor
                    tow_factor = weighted_sum

                # Logic Parity: Frontend factor = p_factor * tow_factor * reuse
                interval_raw_days = fte_original * days_per_fte * years_in_interval
                interval_base_days = interval_raw_days * p_factor
                # interval_days is the effective effort BEFORE rounding
                interval_days = interval_base_days * (tow_factor * reuse_multiplier)

                # Final combined factor for FTE efficiency
                final_factor = p_factor * tow_factor * reuse_multiplier
                effective_fte = fte_original * final_factor
                
                # We'll use this list to accurately share costs between Lutech profiles AND TOWs
                triplets = []
                
                # Mix profili e tariffe
                mix = get_mapping_at(poste_profile_id, start)
                interval_cost = 0.0

                if not mix:
                    # Fallback default — apply YoY inflation escalation
                    rate = profile_rates.get(poste_profile_id, default_daily_rate) * inflation_factor

                    # WYSIWYG: Round days to 2 decimals BEFORE cost
                    l_days_eff = round(interval_days, 2)
                    l_cost = l_days_eff * rate
                    interval_cost = l_cost
                    
                    # Accumula by_lutech_profile (fallback)
                    lid = poste_profile_id
                    if lid not in result["by_lutech_profile"]:
                        result["by_lutech_profile"][lid] = {"cost": 0.0, "days": 0.0, "days_base": 0.0, "days_raw": 0.0, "label": lid, "contributions": []}
                    
                    result["by_lutech_profile"][lid]["cost"] += l_cost
                    result["by_lutech_profile"][lid]["days"] += l_days_eff
                    result["by_lutech_profile"][lid]["days_base"] += interval_base_days
                    result["by_lutech_profile"][lid]["days_raw"] += interval_raw_days
                    result["by_lutech_profile"][lid]["contributions"].append({
                        "member": member_label, 
                        "days": l_days_eff, 
                        "days_base": interval_base_days, 
                        "days_raw": interval_raw_days,
                        "cost": l_cost, 
                        "start": start, "end": m_end,
                        "p_factor": p_factor,
                        "eff_factor": (tow_factor * reuse_multiplier)
                    })
                    
                    triplets.append({
                        "lutech_id": lid,
                        "days_raw": interval_raw_days,
                        "days_base": interval_base_days,
                        "days_eff": l_days_eff,
                        "cost": l_cost,
                        "rate": rate,
                        "p_factor": p_factor,
                        "eff_factor": (tow_factor * reuse_multiplier)
                    })

                    # Store interval for Excel
                    result["intervals"].append({
                        "member": member_label, "start": start, "end": m_end, "months": months_in_interval,
                        "fte_base": fte_original, "factor": final_factor, "fte_eff": (fte_original * final_factor),
                        "rate": rate, "cost": l_cost, "lutech_profile": lid
                    })
                else:
                    for mix_item in mix:
                        lutech_id = (mix_item.get("lutech_profile") if isinstance(mix_item, dict) else getattr(mix_item, "lutech_profile")) or ""
                        pct = (mix_item.get("pct") or 0 if isinstance(mix_item, dict) else getattr(mix_item, "pct") or 0) / 100.0
                        rate = profile_rates.get(lutech_id, default_daily_rate) * inflation_factor
                        
                        # WYSIWYG: Round days per profile
                        mix_days_raw = interval_raw_days * pct
                        mix_days_base = interval_base_days * pct
                        mix_days = round(interval_days * pct, 2)
                        mix_cost = mix_days * rate
                        interval_cost += mix_cost
                        
                        # Accumula by_lutech_profile
                        if lutech_id not in result["by_lutech_profile"]:
                            parts = lutech_id.split(':')
                            label = parts[1] if len(parts) > 1 else lutech_id
                            result["by_lutech_profile"][lutech_id] = {"cost": 0.0, "days": 0.0, "days_base": 0.0, "days_raw": 0.0, "label": label, "contributions": []}
                        
                        result["by_lutech_profile"][lutech_id]["cost"] += mix_cost
                        result["by_lutech_profile"][lutech_id]["days"] += mix_days
                        result["by_lutech_profile"][lutech_id]["days_base"] += mix_days_base
                        result["by_lutech_profile"][lutech_id]["days_raw"] += mix_days_raw
                        result["by_lutech_profile"][lutech_id]["contributions"].append({
                            "member": member_label, 
                            "days": mix_days, 
                            "days_base": mix_days_base, 
                            "days_raw": mix_days_raw,
                            "cost": mix_cost, 
                            "start": start, "end": m_end,
                            "p_factor": p_factor,
                            "eff_factor": (tow_factor * reuse_multiplier)
                        })

                        triplets.append({
                            "lutech_id": lutech_id,
                            "days_raw": mix_days_raw,
                            "days_base": mix_days_base,
                            "days_eff": mix_days,
                            "cost": mix_cost,
                            "rate": rate,
                            "p_factor": p_factor,
                            "eff_factor": (tow_factor * reuse_multiplier)
                        })

                        # Store interval part for Excel
                        result["intervals"].append({
                            "member": member_label, "start": start, "end": m_end, "months": months_in_interval,
                            "fte_base": fte_original, "factor": final_factor * pct, "fte_eff": (fte_original * final_factor) * pct,
                            "rate": rate, "cost": mix_cost, "lutech_profile": lutech_id
                        })

                # Accumulo per membro e per TOW
                member_total_cost += interval_cost
                member_total_days += interval_days
                member_weighted_fte_sum += effective_fte * months_in_interval

                if not tow_allocation:
                    # Fallback TOW if none allocated
                    tow_allocation = {"__no_tow__": 100}
                    total_alloc = 100
                    
                for tow_id, pct in tow_allocation.items():
                    ratio = pct / total_alloc
                    if tow_id not in result["by_tow"]:
                         label = "Da Allocare (Membro senza TOW)" if tow_id == "__no_tow__" else tow_id
                         result["by_tow"][tow_id] = {"cost": 0.0, "days": 0.0, "days_base": 0.0, "days_raw": 0.0, "label": label, "contributions": []}
                    
                    for t in triplets:
                        share_days_raw = t["days_raw"] * ratio
                        share_days_base = t["days_base"] * ratio
                        share_days_eff = round(t["days_eff"] * ratio, 2)
                        share_cost = share_days_eff * t["rate"]
                        
                        result["by_tow"][tow_id]["cost"] += share_cost
                        result["by_tow"][tow_id]["days"] += share_days_eff
                        result["by_tow"][tow_id]["days_base"] += share_days_base
                        result["by_tow"][tow_id]["days_raw"] += share_days_raw
                        result["by_tow"][tow_id]["contributions"].append({
                            "member": member_label, 
                            "cost": share_cost, 
                            "days": share_days_eff, 
                            "days_base": share_days_base, 
                            "days_raw": share_days_raw,
                            "p_factor": t["p_factor"],
                            "eff_factor": t["eff_factor"]
                        })

                        result["total_cost"] += share_cost
                        result["total_days"] += share_days_eff
                        result["total_days_base"] += share_days_base

            # Update final member stats
            result["total_fte_original"] += fte_original
            # NOTE: total_cost and total_days are already accumulated in the TOW loop (lines 367-369)
            # Do NOT add member_total_cost/days again here to avoid double counting
            
            avg_fte = member_weighted_fte_sum / duration_months
            weighted_fte_sum_global += avg_fte
            
            result["by_profile"][poste_profile_id] = {
                "fte_original": fte_original,
                "fte_adjusted": round(avg_fte, 2),
                "days": round(member_total_days, 2),
                "cost": round(member_total_cost, 2),
            }

        result["total_fte_adjusted"] = round(weighted_fte_sum_global, 2)
        
        # Arrotondamenti finali
        result["total_cost"] = round(result["total_cost"], 2)
        result["total_days"] = round(result["total_days"], 2)
        
        for t in result["by_tow"]:
            result["by_tow"][t]["cost"] = round(result["by_tow"][t]["cost"], 2)
            result["by_tow"][t]["days"] = round(result["by_tow"][t]["days"], 2)
        for l in result["by_lutech_profile"]:
            result["by_lutech_profile"][l]["cost"] = round(result["by_lutech_profile"][l]["cost"], 2)
            result["by_lutech_profile"][l]["days"] = round(result["by_lutech_profile"][l]["days"], 2)

        return result

    # NOTA: calculate_tow_cost() rimosso - i costi per TOW sono già
    # disponibili in calculate_team_cost()["by_tow"]

    @staticmethod
    def _compute_lutech_rate_from_mapping(
        mappings: List[Any],
        profile_rates: Dict[str, float],
        duration_months: int,
        default_daily_rate: float,
        inflation_pct: float = 0.0,
    ) -> float:
        """Compute duration-weighted average Lutech daily rate from a time-varying mapping.
        Applies YoY inflation: year 0 = no change, year 1 = +inflation_pct%, etc.
        """
        if not mappings:
            return default_daily_rate

        total_weighted = 0.0
        total_months = 0

        for m in mappings:
            if isinstance(m, dict):
                month_start = m.get("month_start", 1)
                month_end = m.get("month_end", duration_months)
                mix = m.get("mix", [])
            else:
                month_start = getattr(m, "month_start", 1)
                month_end = getattr(m, "month_end", duration_months)
                mix = getattr(m, "mix", [])

            months = max(0, month_end - month_start + 1)
            if months <= 0 or not mix:
                continue

            period_rate = 0.0
            for mix_item in mix:
                if isinstance(mix_item, dict):
                    lutech_id = mix_item.get("lutech_profile", "")
                    mix_pct = float(mix_item.get("pct", 0) or 0) / 100.0
                else:
                    lutech_id = getattr(mix_item, "lutech_profile", "")
                    mix_pct = float(getattr(mix_item, "pct", 0) or 0) / 100.0
                
                base_rate = profile_rates.get(lutech_id, default_daily_rate)
                period_rate += mix_pct * base_rate

            # Apply YoY inflation escalation to this period
            year_index = (month_start - 1) // 12
            inflation_factor = (1 + inflation_pct / 100) ** year_index if inflation_pct > 0 else 1.0
            inflated_period_rate = period_rate * inflation_factor

            total_weighted += inflated_period_rate * months
            total_months += months

        if total_months <= 0:
            return default_daily_rate
        return total_weighted / total_months

    @staticmethod
    def _compute_catalog_item_rate(
        profile_mix: List[Any],
        profile_mappings: Dict[str, Any],
        profile_rates: Dict[str, float],
        duration_months: int,
        default_daily_rate: float,
        inflation_pct: float = 0.0,
    ) -> float:
        """
        Compute weighted average Lutech daily rate for a catalog item.
        profile_mix: [{"poste_profile": "ios_dev", "pct": 30}, ...]
        Each Poste profile is resolved via profile_mappings → Lutech profiles → rates.
        YoY inflation is applied.
        """
        total_weighted_rate = 0.0
        total_pct = 0.0

        for entry in profile_mix:
            if isinstance(entry, dict):
                poste_profile = entry.get("poste_profile", "")
                pct = float(entry.get("pct", 0) or 0) / 100.0
            else:
                poste_profile = getattr(entry, "poste_profile", "")
                pct = float(getattr(entry, "pct", 0) or 0) / 100.0

            if pct <= 0:
                continue

            mappings = profile_mappings.get(poste_profile, [])
            if mappings:
                lutech_rate = BusinessPlanService._compute_lutech_rate_from_mapping(
                    mappings, profile_rates, duration_months, default_daily_rate, inflation_pct
                )
            else:
                lutech_rate = profile_rates.get(poste_profile, default_daily_rate)

            total_weighted_rate += pct * lutech_rate
            total_pct += pct

        if total_pct <= 0:
            return default_daily_rate
        return total_weighted_rate / total_pct

    @staticmethod
    def _compute_cluster_distribution(
        catalog_items: List[Any],
        catalog_clusters: List[Any],
        item_days_list: Optional[List[float]] = None,
    ) -> Dict[str, Any]:
        """
        Compute actual distribution across clusters, weighted by item FTE (o item_days nel vecchio modello).
        Returns {cluster_id: {label, profiles, required_pct, constraint_type, actual_pct, delta, ok}}
        
        Constraint types:
        - "equality" (=): actual_pct must equal required_pct (±2% tolerance)
        - "minimum" (>=): actual_pct must be >= required_pct
        - "maximum" (<=): actual_pct must be <= required_pct
        """
        if not catalog_clusters:
            return {}

        profile_to_cluster: Dict[str, str] = {}
        for cluster in catalog_clusters:
            cid = cluster.get("id", "") if isinstance(cluster, dict) else getattr(cluster, "id", "")
            profiles = cluster.get("poste_profiles", []) if isinstance(cluster, dict) else getattr(cluster, "poste_profiles", [])
            for p in profiles:
                profile_to_cluster[p] = cid

        cluster_actual: Dict[str, float] = {}
        for cluster in catalog_clusters:
            cid = cluster.get("id", "") if isinstance(cluster, dict) else getattr(cluster, "id", "")
            cluster_actual[cid] = 0.0

        # Weight each item's profile distribution by its days relative to total
        days_list = item_days_list or [1.0] * len(catalog_items)
        total_days = sum(days_list) or 1.0

        for i, item in enumerate(catalog_items):
            item_days = days_list[i] if i < len(days_list) else 0.0
            weight = item_days / total_days  # fraction of total days

            profile_mix = item.get("profile_mix", []) if isinstance(item, dict) else getattr(item, "profile_mix", [])
            profile_mix = profile_mix or []

            for entry in profile_mix:
                if isinstance(entry, dict):
                    poste_profile = entry.get("poste_profile", "")
                    pct = float(entry.get("pct", 0) or 0)
                else:
                    poste_profile = getattr(entry, "poste_profile", "")
                    pct = float(getattr(entry, "pct", 0) or 0)

                cid = profile_to_cluster.get(poste_profile)
                if cid and cid in cluster_actual:
                    cluster_actual[cid] += weight * pct

        result: Dict[str, Any] = {}
        for cluster in catalog_clusters:
            if isinstance(cluster, dict):
                cid = cluster.get("id", "")
                label = cluster.get("label", cid)
                required_pct = float(cluster.get("required_pct", 0) or 0)
                profiles = cluster.get("poste_profiles", [])
                constraint_type = cluster.get("constraint_type", "equality")  # Default to equality for backward compatibility
            else:
                cid = getattr(cluster, "id", "")
                label = getattr(cluster, "label", cid)
                required_pct = float(getattr(cluster, "required_pct", 0) or 0)
                profiles = getattr(cluster, "poste_profiles", [])
                constraint_type = getattr(cluster, "constraint_type", "equality")

            actual_pct = cluster_actual.get(cid, 0.0)
            delta = actual_pct - required_pct
            
            # Validate based on constraint type
            if constraint_type == "maximum":
                ok = actual_pct <= required_pct
            elif constraint_type == "minimum":
                ok = actual_pct >= required_pct
            else:  # "equality" or default
                ok = abs(delta) <= 2.0
            
            result[cid] = {
                "label": label,
                "profiles": profiles,
                "required_pct": required_pct,
                "constraint_type": constraint_type,
                "actual_pct": round(actual_pct, 2),
                "delta": round(delta, 2),
                "ok": ok,
            }

        return result

    @staticmethod
    def calculate_catalog_cost(
        tows: List[Any],
        profile_mappings: Dict[str, Any],
        profile_rates: Dict[str, float],
        duration_months: int,
        default_daily_rate: float = 250.0,
        days_per_fte: int = 220,
        inflation_pct: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Calcola il costo dei TOW tipo 'catalogo' con modello FTE-FROM-GROUP.

        Gerarchia:
          TOW (total_fte, total_catalog_value, target_margin_pct)
            └─ Raggruppamento (target_value → group_fte = target_value/total_catalog × total_fte)
                 └─ Voce (group_pct → item_fte = group_fte × pct/100)
                      item_cost = item_fte × rate × anni × days_per_fte
                      item_sell = item_cost / (1 − margine_target/100)
                      item_poste_total = group_target × pct/100
                      item_lutech_unit = (sell / poste_total) × price_base
                      item_sconto_pct = (1 − lutech_unit / price_base) × 100

        Returns: { total_cost, by_tow: { tow_id: { cost, revenue, margin, items, cluster_distribution } } }
        """
        total_cost = 0.0
        by_tow: Dict[str, Any] = {}
        duration_years = (duration_months or 36) / 12.0

        for tow in tows:
            if isinstance(tow, dict):
                tow_type = tow.get("type", "")
            else:
                tow_type = getattr(tow, "type", "")

            if tow_type != "catalogo":
                continue

            if isinstance(tow, dict):
                tow_id = tow.get("tow_id", "")
                tow_label = tow.get("label", tow_id)
                ref_total_fte = float(tow.get("total_fte", 0) or 0)
                total_catalog_value = float(tow.get("total_catalog_value", 0) or 0)
                default_target_margin_pct = float(tow.get("target_margin_pct", 20.0) or 20.0)
                sconto_gara_pct = float(tow.get("sconto_gara_pct", 0) or 0)
                catalog_items = tow.get("catalog_items", []) or []
                catalog_clusters = tow.get("catalog_clusters", []) or []
                catalog_groups = tow.get("catalog_groups", []) or []
                default_catalog_reuse_factor = float(tow.get("catalog_reuse_factor", 0.0) or 0.0)
            else:
                tow_id = getattr(tow, "tow_id", "")
                tow_label = getattr(tow, "label", tow_id)
                ref_total_fte = float(getattr(tow, "total_fte", 0) or 0)
                total_catalog_value = float(getattr(tow, "total_catalog_value", 0) or 0)
                default_target_margin_pct = float(getattr(tow, "target_margin_pct", 20.0) or 20.0)
                sconto_gara_pct = float(getattr(tow, "sconto_gara_pct", 0) or 0)
                catalog_items = getattr(tow, "catalog_items", []) or []
                catalog_clusters = getattr(tow, "catalog_clusters", []) or []
                catalog_groups = getattr(tow, "catalog_groups", []) or []
                default_catalog_reuse_factor = float(getattr(tow, "catalog_reuse_factor", 0.0) or 0.0)

            # Fattore sconto gara/lotto (proporzionale su valori Poste, non tocca costi Lutech)
            sconto_gara_factor = 1.0 - sconto_gara_pct / 100.0

            # Build group lookup: item_id → group
            item_group_map: Dict[str, Any] = {}
            for g in catalog_groups:
                g_ids = g.get("item_ids", []) if isinstance(g, dict) else getattr(g, "item_ids", [])
                for iid in (g_ids or []):
                    item_group_map[iid] = g

            tow_cost = 0.0
            tow_sell_price = 0.0
            items_result = []
            item_fte_list = []

            for item in catalog_items:
                if isinstance(item, dict):
                    item_id = item.get("id", "")
                    item_label = item.get("label", item_id)
                    price_base = float(item.get("price_base", 0) or 0)
                    item_pct = float(item.get("group_pct", 0) or 0)
                    raw_margin = item.get("target_margin_pct")
                    profile_mix = item.get("profile_mix", []) or []
                else:
                    item_id = getattr(item, "id", "")
                    item_label = getattr(item, "label", item_id)
                    price_base = float(getattr(item, "price_base", 0) or 0)
                    item_pct = float(getattr(item, "group_pct", 0) or 0)
                    raw_margin = getattr(item, "target_margin_pct", None)
                    profile_mix = getattr(item, "profile_mix", []) or []

                # FTE dalla gerarchia gruppo → voce
                group = item_group_map.get(item_id)
                if group is not None:
                    group_target = float(group.get("target_value", 0) if isinstance(group, dict) else getattr(group, "target_value", 0) or 0)
                else:
                    group_target = 0.0

                group_fte = (
                    (group_target / total_catalog_value) * ref_total_fte
                    if total_catalog_value > 0 and group_target > 0
                    else 0.0
                )

                # NEW: Apply reuse factor (group-level override or TOW-level default)
                group_reuse_raw = group.get("reuse_factor") if group is not None else None
                # Convert from % to decimal if needed (assuming frontend sends 0-100)
                # For now, assuming 0-1 decimal format from frontend.
                group_reuse_factor = float(group_reuse_raw if group_reuse_raw is not None else default_catalog_reuse_factor)
                effective_group_fte = group_fte * (1.0 - group_reuse_factor)

                item_fte = effective_group_fte * item_pct / 100.0

                # Tariffa Lutech media dal mix figure
                lutech_rate = BusinessPlanService._compute_catalog_item_rate(
                    profile_mix, profile_mappings, profile_rates,
                    duration_months, default_daily_rate, inflation_pct
                )

                # FTE-FROM-GROUP: FTE → costo → prezzo vendita
                item_cost = item_fte * lutech_rate * duration_years * days_per_fte

                effective_margin = default_target_margin_pct if (raw_margin is None) else float(raw_margin)
                margin_factor = 1.0 - effective_margin / 100.0
                item_sell = (item_cost / margin_factor) if margin_factor > 0.001 else item_cost

                # Applica sconto gara/lotto ai valori Poste
                effective_group_target = group_target * sconto_gara_factor
                effective_price_base = price_base * sconto_gara_factor

                # Pz. Poste Tot. effettivo (post sconto gara)
                item_poste_total = effective_group_target * item_pct / 100.0

                # Pz. Unitario Lutech e Sconto %
                item_lutech_unit = (
                    (item_sell / item_poste_total) * effective_price_base
                    if item_poste_total > 0 and effective_price_base > 0
                    else 0.0
                )
                item_sconto_pct = (
                    (1.0 - item_lutech_unit / price_base) * 100.0
                    if price_base > 0 and item_lutech_unit > 0
                    else 0.0
                )

                tow_cost += item_cost
                tow_sell_price += item_sell
                item_fte_list.append(item_fte)

                items_result.append({
                    "id": item_id,
                    "label": item_label,
                    "price_base": price_base,
                    "group_pct": round(item_pct, 2),
                    "poste_total": round(item_poste_total, 2),
                    "effective_margin_pct": round(effective_margin, 2),
                    "item_fte": round(item_fte, 4),
                    "avg_daily_rate": round(lutech_rate, 2),
                    "lutech_cost": round(item_cost, 2),
                    "lutech_revenue": round(item_sell, 2),
                    "lutech_margin": round(item_sell - item_cost, 2),
                    "lutech_unit_price": round(item_lutech_unit, 2),
                    "sconto_pct": round(item_sconto_pct, 2),
                })

            # Totali TOW
            total_derived_fte = sum(item_fte_list)
            tow_margin = tow_sell_price - tow_cost
            tow_margin_pct = (tow_margin / tow_sell_price * 100.0) if tow_sell_price > 0 else 0.0

            # Cluster distribution pesata su FTE (non giorni)
            cluster_distribution = BusinessPlanService._compute_cluster_distribution(
                catalog_items, catalog_clusters, item_fte_list
            )

            by_tow[tow_id] = {
                "label": tow_label,
                "type": "catalogo",
                "ref_total_fte": round(ref_total_fte, 4),
                "total_derived_fte": round(total_derived_fte, 4),
                "total_catalog_value": round(total_catalog_value, 2),
                "cost": round(tow_cost, 2),
                "revenue": round(tow_sell_price, 2),
                "margin": round(tow_margin, 2),
                "margin_pct": round(tow_margin_pct, 2),
                "items": items_result,
                "cluster_distribution": cluster_distribution,
            }

            total_cost += tow_cost

        return {
            "total_cost": round(total_cost, 2),
            "by_tow": by_tow,
        }

    @staticmethod
    def calculate_total_cost(bp_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        STEP 5: Calcola costi totali con breakdown.
        
        Returns:
            {"team": ..., "governance": ..., "risk": ..., "subcontract": ..., "total": ...}
        """
        team_cost = float(bp_data.get("total_cost", 0.0))
        governance_pct = float(bp_data.get("governance_pct", 0.04))
        risk_pct = float(bp_data.get("risk_contingency_pct", 0.03))

        governance_cost = team_cost * governance_pct
        # Risk includes governance cost (aligned with frontend calculation)
        risk_cost = (team_cost + governance_cost) * risk_pct

        # Subcontract
        sub_config = bp_data.get("subcontract_config", {})
        sub_quota = float(sub_config.get("quota_pct", 0.0))
        subcontract_cost = team_cost * sub_quota

        total = team_cost + governance_cost + risk_cost + subcontract_cost

        return {
            "team": round(team_cost, 2),
            "governance": round(governance_cost, 2),
            "risk": round(risk_cost, 2),
            "subcontract": round(subcontract_cost, 2),
            "total": round(team_cost + governance_cost + risk_cost + subcontract_cost, 2),
        }

    @staticmethod
    def calculate_margin(
        base_amount: float,
        total_cost: float,
        discount_pct: float = 0.0,
        is_rti: bool = False,
        quota_lutech: float = 1.0,
    ) -> Dict[str, Any]:
        """
        Calcola margine (singolo o RTI).
        
        Args:
            base_amount: Importo base a base d'asta
            total_cost: Costo totale calcolato
            discount_pct: Sconto percentuale offerto
            is_rti: Se RTI
            quota_lutech: Quota Lutech (0.0-1.0) se RTI
        
        Returns:
            {"revenue": ..., "cost": ..., "margin": ..., "margin_pct": ...}
        """
        revenue = base_amount * (1 - discount_pct / 100)

        if is_rti:
            revenue = revenue * quota_lutech

        margin = revenue - total_cost
        margin_pct = (margin / revenue * 100) if revenue > 0 else 0.0

        return {
            "revenue": round(revenue, 2),
            "cost": round(total_cost, 2),
            "margin": round(margin, 2),
            "margin_pct": round(margin_pct, 2),
        }

    @staticmethod
    def find_discount_for_margin(
        base_amount: float,
        total_cost: float,
        target_margin_pct: float,
        is_rti: bool = False,
        quota_lutech: float = 1.0,
    ) -> float:
        """
        Trova lo sconto necessario per raggiungere un margine target.
        
        margin = (revenue - cost) / revenue
        target = (base*(1-d)*q - cost) / (base*(1-d)*q)
        => target * base*(1-d)*q = base*(1-d)*q - cost
        => cost = base*(1-d)*q * (1 - target)
        => (1-d) = cost / (base * q * (1 - target))
        => d = 1 - cost / (base * q * (1 - target))
        """
        target = target_margin_pct / 100
        q = quota_lutech if is_rti else 1.0
        denominator = base_amount * q * (1 - target)

        if denominator <= 0:
            return 0.0

        discount = 1 - (total_cost / denominator)
        return round(max(0, min(100, discount * 100)), 2)

    @staticmethod
    def generate_scenarios(
        bp_data: Dict[str, Any],
        base_amount: float,
        team_composition: Optional[List[Dict[str, Any]]] = None,
        volume_adjustments: Optional[Dict[str, Any]] = None,
        profile_mappings: Optional[Dict[str, Any]] = None,
        profile_rates: Optional[Dict[str, float]] = None,
        duration_months: int = 36,
        default_daily_rate: float = 250.0,
        governance_pct: float = 0.04,
        risk_contingency_pct: float = 0.03,
        subcontract_config: Optional[Dict[str, Any]] = None,
        catalog_cost: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Genera 3 scenari: Conservative/Balanced/Aggressive.
        Se team_composition è fornito, ricalcola i costi per ogni scenario.
        Altrimenti usa stima lineare come fallback.
        """
        # Recupera parametri attuali dal BP
        current_reuse = float(bp_data.get("reuse_factor", 0.05))
        vol_adj_dict = volume_adjustments or bp_data.get("volume_adjustments", {})
        current_vol_global = float(vol_adj_dict.get("global", 1.0))

        # Definisci delta per i 3 scenari rispetto all'attuale
        scenario_configs = [
            ("Current/Balanced", 0.0, 0.0),
            ("Conservative", -0.05, 0.05),
            ("Aggressive", 0.05, -0.05),
        ]

        scenarios = []

        # Se abbiamo tutti i dati, ricalcola per ogni scenario
        can_recalculate = (
            team_composition is not None and
            len(team_composition) > 0 and
            profile_mappings is not None
        )

        for name, reuse_delta, vol_delta in scenario_configs:
            new_reuse = max(0.0, min(0.8, current_reuse + reuse_delta))
            new_vol = max(0.5, min(1.5, current_vol_global + vol_delta))

            if can_recalculate:
                # Modifica volume_adjustments con il nuovo global factor
                scenario_vol_adj = dict(vol_adj_dict)
                scenario_vol_adj["global"] = new_vol

                # Ricalcola team cost con nuovi parametri
                team_result = BusinessPlanService.calculate_team_cost(
                    team_composition=team_composition or [],
                    volume_adjustments=scenario_vol_adj,
                    reuse_factor=new_reuse,
                    profile_mappings=profile_mappings or {},
                    profile_rates=profile_rates or {},
                    duration_months=duration_months,
                    default_daily_rate=default_daily_rate,
                )
                team_cost = team_result["total_cost"]

                # Il catalog_cost è fisso (FTE dal bando, non variano per scenario)
                base_for_overhead = team_cost + catalog_cost

                # Aggiungi overhead sulla base completa (team + catalog)
                governance_cost = base_for_overhead * governance_pct
                # Risk includes governance cost (aligned with frontend calculation)
                risk_cost = (base_for_overhead + governance_cost) * risk_contingency_pct
                sub_quota = float((subcontract_config or {}).get("quota_pct", 0.0))
                subcontract_cost = base_for_overhead * sub_quota

                estimated_cost = base_for_overhead + governance_cost + risk_cost + subcontract_cost
            else:
                # Fallback a stima lineare
                total_cost = float(bp_data.get("total_cost", 0.0))
                if current_vol_global <= 0:
                    current_vol_global = 1.0
                denom = current_vol_global * (1 - current_reuse)
                raw_cost_est = total_cost / denom if denom > 0 else total_cost
                estimated_cost = raw_cost_est * new_vol * (1 - new_reuse)

            margin_result = BusinessPlanService.calculate_margin(
                base_amount, estimated_cost, discount_pct=0
            )
            scenarios.append({
                "name": name,
                "reuse_factor": round(new_reuse, 2),
                "volume_adjustment": round(new_vol, 2),
                "total_cost": round(estimated_cost, 2),
                **margin_result,
            })

        return scenarios
