/**
 * modalMetrics — the shared frame footprint for the app's "wide form" modals
 * (+ Kandidaat toevoegen, + Match aanmaken). Danny 24-07 point 6: the two had
 * drifted apart (1060px/94vh vs 900px/90vh) even though both are the same kind
 * of screen (a titled-card create form) — one constant now backs both, so a
 * future resize only ever touches this file. Adopted by AddCandidateModal.tsx
 * and match/styles.ts.
 */
export const WIDE_MODAL = { maxWidth: 1060, maxHeight: '94vh' } as const
