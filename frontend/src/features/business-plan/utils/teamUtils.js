/**
 * Returns effective GG/anno for a profile.
 * If manual_days_year is set (> 0), it takes priority.
 * Otherwise falls back to FTE × daysPerFte.
 */
export const getEffectiveDaysYear = (profile, daysPerFte) => {
  if (profile.manual_days_year && parseFloat(profile.manual_days_year) > 0) {
    return parseFloat(profile.manual_days_year);
  }
  return (parseFloat(profile.fte) || 0) * daysPerFte;
};
