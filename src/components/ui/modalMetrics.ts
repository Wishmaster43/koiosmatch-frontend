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
// KLANT-LAYOUT-4 / KANS-BREEDTE-1 (Danny 14-08 "moet breder want tekst past niet eens" —
// the opportunity modal cut off its right column and scrolled sideways). 1060 -> 1200 here,
// so every wide create modal gains the room at once.
export const WIDE_MODAL = { maxWidth: 1320, maxHeight: '94vh' } as const
