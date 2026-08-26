/**
 * campaignAdvice — the ONE deterministic rule engine behind the outreach
 * (bellijsten, "call lists") table's "Koios" column. Mirrors candidateAdvice.ts's
 * reference design: rules only read fields the LIST row already carries (status,
 * target count, created_at, archived) — no new fetch, no invented data.
 */
import type { Campaign } from '../hooks/useOutreachCampaigns'

export type CampaignAdviceAction = 'attention' | 'none'

export interface CampaignAdviceRule {
  action: CampaignAdviceAction
  reasonKey: string
}

// A draft sitting this many days with targets already loaded but never
// activated is worth a nudge — fixed threshold (no tenant setting yet, unlike
// vacancies/matches, to keep this simple rule dependency-free).
const STALE_DRAFT_DAYS = 14

const NONE_RULE: CampaignAdviceRule = { action: 'none', reasonKey: 'koios.reasons.none' }

// First-match-wins priority ladder  for the read-set constraint.
export function deriveCampaignAdvice(c: Campaign, now: Date = new Date()): CampaignAdviceRule {
  // Rule 1: no advice on an archived (soft-deleted) campaign.
  if (c.archived) return NONE_RULE

  const targetCount = c.targets_count ?? c.target_count ?? 0

  // Rule 2: an active campaign with nothing to call/mail/message is misconfigured.
  if (c.status === 'active' && targetCount === 0) return { action: 'attention', reasonKey: 'koios.reasons.noTargets' }

  // Rule 3: a draft with targets already loaded but never activated, sitting
  // stale — worth a nudge to start it or clean it up.
  if (c.status === 'draft' && targetCount > 0 && c.created_at) {
    const days = daysSince(c.created_at, now)
    if (days != null && days >= STALE_DRAFT_DAYS) return { action: 'attention', reasonKey: 'koios.reasons.staleDraft' }
  }

  // Rule 4: nothing to flag.
  return NONE_RULE
}

// Whole-day difference between a date string and now; null when the date is unreadable.
function daysSince(dateStr: string, now: Date): number | null {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}
