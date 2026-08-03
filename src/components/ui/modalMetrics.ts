/**
 * modalMetrics — the shared frame footprint for the app's "wide form" modals
 * (+ Kandidaat toevoegen, + Match aanmaken). Danny 24-07 point 6: the two had
 * drifted apart (1060px/94vh vs 900px/90vh) even though both are the same kind
 * of screen (a titled-card create form) — one constant now backs both, so a
 * future resize only ever touches this file. Adopted by AddCandidateModal.tsx
 * and match/styles.ts.
 */
// NO minHeight (Danny 03-08, second round): pinning it made SHORT forms (afdeling,
// contactpersoon, kans) balloon to full height with dead space — eleven surfaces use
// this constant, not just the tall six. Modals size to content up to the cap; the
// perceived-size parity comes from the shared two-column layout system instead.
export const WIDE_MODAL = { maxWidth: 1060, maxHeight: '94vh' } as const
