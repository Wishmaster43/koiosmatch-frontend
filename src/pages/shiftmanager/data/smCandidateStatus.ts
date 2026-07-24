/**
 * smCandidateStatus — the ShiftManager candidate status palette, shared by
 * SmCandidatesInsightsRow (status donut) and SmCandidatesTable (status chip) so
 * the same status value always reads the same colour in both places. Mirrors
 * the fixed palette already used by reports/CandidatesTable + DrillDownDrawer's
 * StatusBadge (kept as one source here instead of a third inline copy).
 */
export const SM_CANDIDATE_STATUS_COLORS: Record<string, string> = {
  actief:     'var(--color-success)',
  nietactief: 'var(--color-warning)',
  extern:     'var(--color-secondary)',
  intake:     'var(--color-violet)',
  verwijderd: 'var(--color-danger)',
}

// Canonical iteration order for the status donut (fixed, not alphabetical).
export const SM_CANDIDATE_STATUS_KEYS = Object.keys(SM_CANDIDATE_STATUS_COLORS)
