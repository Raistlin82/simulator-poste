"""
Scoring Service - Business logic for technical and economic scoring
"""
import logging
from typing import Dict, List
import numpy as np

logger = logging.getLogger(__name__)


class ScoringService:
    """Service for calculating scores"""

    @staticmethod
    def calculate_economic_score(
        p_base: float,
        p_offered: float,
        p_best_competitor: float,
        alpha: float = 0.3,
        max_econ: float = 40.0
    ) -> float:
        """
        Calculate economic score with progressive discount reward.

        Uses interpolation formula with alpha exponent for progressive discounting reward.

        Args:
            p_base: Base price
            p_offered: Our offered price
            p_best_competitor: Best competitor's price
            alpha: Exponent factor (0-1) for discount curve
            max_econ: Maximum economic score achievable

        Returns:
            Economic score (0 to max_econ)
        """
        # Price must be less than or equal to base
        if p_offered > p_base:
            return 0.0

        # Get the best price between us and competitor
        actual_best = min(p_offered, p_best_competitor)

        # Calculate denominator (spread from base to best price)
        denom = p_base - actual_best
        if denom <= 0:
            # Edge case: if no discount spread exists
            # If both prices equal base price, no discount → score = 0
            # If best price > base price (invalid), return 0
            logger.warning(
                f"Economic score calculation: zero/negative denominator. "
                f"p_base={p_base}, p_offered={p_offered}, p_best_competitor={p_best_competitor}, "
                f"actual_best={actual_best}, denom={denom}"
            )
            return 0.0

        # Calculate numerator (our discount)
        num = p_base - p_offered

        # Calculate ratio (0 to 1)
        ratio = num / denom

        # Clamp ratio to [0, 1]
        ratio = max(0.0, min(1.0, ratio))

        # Apply alpha exponent and scale to max
        return max_econ * (ratio ** alpha)

    # NOTE: professional-score logic lives in main.calculate_prof_score, which
    # also handles the proportional `max_points_manual` mode. A second copy used
    # to live here, diverged, and was never called — removed to avoid drift.
