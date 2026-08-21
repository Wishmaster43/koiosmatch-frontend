/**
 * outreach — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { deriveCampaignAdvice } from './data/campaignAdvice'
export type { Campaign } from './hooks/useOutreachCampaigns'
export { default as OutreachTargetNotePopout } from './popout/OutreachTargetNotePopout'
