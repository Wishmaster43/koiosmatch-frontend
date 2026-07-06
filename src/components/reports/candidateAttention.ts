/**
 * calcAandacht — the single source for "Aandachtskandidaten": active candidates who
 * are new (<30 days) AND not planned yet. Shared by the candidates report
 * (CandidatesKpiRow) and the SM dashboard so both KPIs match exactly (Danny).
 *
 * NB: a second rule "active but never logged in" is intentionally NOT here — the SM
 * candidate `last_login_at` is on the model but not exposed by the resource (BE
 * handoff); adding it now would flag everyone. The "works less than normal" rules
 * need future per-candidate hours (shifts-per-candidate) and come later.
 */
import type { ReportCandidate } from '@/types/reports'

export function calcAandacht(candidates: ReportCandidate[]) {
  const now = Date.now()
  return candidates.filter(c => {
    if ((c.status || '').toLowerCase() !== 'actief') return false
    const reg = c.registration_date ? new Date(c.registration_date) : null
    const isNew = reg && (now - reg.getTime()) < 30 * 86400000
    const hasNoPlanned = !c.last_planned_shift || new Date(c.last_planned_shift) < new Date()
    return isNew && hasNoPlanned
  })
}
