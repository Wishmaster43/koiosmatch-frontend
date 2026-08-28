/**
 * smCandidateStatus — the Shiftmanager candidate status palette, shared by
 * SmCandidatesInsightsRow (status donut) and SmCandidatesTable (status chip) so
 * the same status value always reads the same colour in both places. The KEYS
 * come from lib/smStatus — the one external-vocabulary source since bb76cf87 —
 * only the colour assignment lives here.
 */
import { SM_STATUS } from '@/lib/smStatus'

export const SM_CANDIDATE_STATUS_COLORS: Record<string, string> = {
  [SM_STATUS.ACTIVE]:   'var(--color-success)',
  [SM_STATUS.INACTIVE]: 'var(--color-warning)',
  [SM_STATUS.EXTERNAL]: 'var(--color-secondary)',
  [SM_STATUS.INTAKE]:   'var(--color-violet)',
  [SM_STATUS.DELETED]:  'var(--color-danger)',
}

// Canonical iteration order for the status donut (fixed, not alphabetical).
export const SM_CANDIDATE_STATUS_KEYS = Object.keys(SM_CANDIDATE_STATUS_COLORS)
