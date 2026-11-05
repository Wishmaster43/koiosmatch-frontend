/** AddOpportunityModal test fixtures (split from AddOpportunityModal.test.tsx): plain data shared by the split suites. */
/* eslint-disable no-restricted-syntax -- fixture DATA mirroring the seed stage colours, not UI styling */
// A STABLE array reference (built once, at module-eval time) — the modal's own
// stageId-resolve effect depends on `[stages]`; a fresh array literal on every
// call (the old inline shape) re-fires that effect on every render and silently
// resets a manually-picked stage back to `existing.stageValue` (mirrors the real
// hook's memoized `stages`, which is stable across renders in production).
export const STAGES = [
  { id: 'stage-1', value: 'lead', label: 'Lead', color: '#94A3B8' },
  { id: 'stage-2', value: 'won', label: 'Gewonnen', color: '#79B58E' },
  // OPP-LOST-FE-1: the one is_lost stage the guard tests target — colour
  // mirrors DEFAULT_OPPORTUNITY_STAGES's own 'lost' seed entry.
  { id: 'stage-3', value: 'lost', label: 'Verloren', color: '#D98A8A', isLost: true },
]
