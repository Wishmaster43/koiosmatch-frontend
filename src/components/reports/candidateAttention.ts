/**
 * calcAandacht — the single source for "Aandachtskandidaten": active candidates who are
 * either (a) new (<30 days) AND not planned yet, OR (b) never logged in. Shared by the
 * candidates report (CandidatesKpiRow) and the SM dashboard so both KPIs match (Danny).
 *
 * The "never logged in" rule is back now that `last_login_at` is exposed on
 * SmCandidateResource (BE 2026-07-07). It previously flagged everyone (123/123) because
 * the field was undefined. The "works less than normal" rules use the
 * shifts-per-candidate feed and live on the Shift-analyse page.
 */
import type { ReportCandidate } from '@/types/reports'

export function calcAandacht(candidates: ReportCandidate[]) {
  const now = Date.now()
  return candidates.filter(c => {
    if ((c.status || '').toLowerCase() !== 'actief') return false
    const reg = c.registration_date ? new Date(c.registration_date) : null
    const isNew = reg && (now - reg.getTime()) < 30 * 86400000
    const hasNoPlanned = !c.last_planned_shift || new Date(c.last_planned_shift) < new Date()
    const newNotPlanned = isNew && hasNoPlanned
    // Active but never logged in — an engagement gap worth surfacing.
    const neverLoggedIn = !c.last_login_at
    return newNotPlanned || neverLoggedIn
  })
}
