/**
 * matchWeights — the six per-dimension scoring keys (mirrors the backend
 * MatchDimension enum) plus the merge-over-neutral-default helper, shared by
 * the drawer's MatchingTab and the "+ Vacature" create form's MatchProfileCard
 * so both read the identical dimension set/default — never two hand-kept copies.
 */
export const MATCH_DIMENSIONS = [
  'qualifications', 'technical_fit', 'soft_skills', 'cultural_alignment', 'career_aspirations', 'location',
] as const

// Merge a stored/template weight set over the neutral default (3 = balanced) for a complete set.
export function buildMatchWeights(w: Record<string, unknown> | undefined): Record<string, number> {
  return Object.fromEntries(MATCH_DIMENSIONS.map(d => [d, Number((w ?? {})[d]) || 3]))
}
