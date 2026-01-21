
def calculate_economic_score(
    p_base, p_offered, p_best_competitor, alpha=0.3, max_econ=40.0
):
    """
    Calculate economic score.
    Formula: Max_Econ × [(P_base - P_offered) / (P_base - min(P_offered, P_best_competitor))] ^ alpha
    """
    if p_offered > p_base:
        return 0.0
    actual_best = min(p_offered, p_best_competitor)
    denom = p_base - actual_best
    if denom <= 0:
        return 0.0
    num = p_base - p_offered
    ratio = num / denom
    if ratio > 1:
        ratio = 1.0  # Our discount is better than competitor
    if ratio < 0:
        ratio = 0.0
    return max_econ * (ratio**alpha)


def calculate_prof_score(R, C, max_res, max_points, max_certs=5):
    # Enforce constraints
    R = min(R, max_res)
    C = min(C, max_certs)
    if R < C:
        C = R
    # Formula unica da capitolato: (2*R) + (R*C)
    score = (2 * R) + (R * C)
    return min(score, max_points)
