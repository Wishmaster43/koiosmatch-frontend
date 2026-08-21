/**
 * matches — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { default as MatchCard } from './MatchCard'
export { deriveMatchAdvice } from './data/matchAdvice'
export { mapMatch } from './hooks/useMatches'
export { computeMatchExpiry } from './matchExpiry'
export { MATCH_COL_ACTIONS, MATCH_COL_OTHER_PARTY, MATCH_COL_SCORE, MATCH_COL_STATUS } from './matchRowColumns'
export { default as MatchTextPopout } from './popout/MatchTextPopout'
export { default as MatchListHeaderBar } from './MatchListHeaderBar'
