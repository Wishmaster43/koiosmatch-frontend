import { useTranslation } from 'react-i18next'
import { overlapHoursSum } from './matchConflicts'
import type { ExistingMatchRow } from './matchConflicts'

// One existing match's display label — vacancy title first, else the client name,
// never a raw id (never surface an internal identifier to the recruiter).
const labelOf = (m: ExistingMatchRow): string => m.vacancyTitle || m.client || '—'

// Trim a decimal:2-cast hours sum to a clean display number — 40 instead of
// "40.00", 36.5 stays "36.5" (never a raw floating-point tail).
const formatHoursSum = (n: number): string => String(Math.round(n * 100) / 100)

/**
 * MatchConflictBanners — the two calm, non-blocking warnings from the duplicate +
 * overlap preflight (Danny's ten-point round, points 5/6: 1.10/1.11). Both are
 * WARN-only (house rule: never block a create) — an inline note, no button
 * gating. Split out of MatchModal to keep that file a thin container (mirrors
 * RateProposalNotice, which owns its own `useTranslation` rather than taking `t`
 * as a prop — same shape here).
 *
 * Hours-sum escalation (Danny, on top of MATCH-LIST-HOURS-1): when the drafted
 * match's own hours AND an overlapping match's hours are BOTH known and their
 * sum exceeds a full-time week, the plain date-only note (`overlapWarning`)
 * swaps for a stronger one (`overlapWarningHours`) naming the combined hours —
 * still the same calm warning-tinted banner, wording only. "Offered-iff-read":
 * a row without `hoursPerWeek`, or no `draftHours` passed in yet, keeps the
 * existing date-only wording — see `overlapHoursSum` (matchConflicts.ts).
 */
export default function MatchConflictBanners({
  duplicateMatch, overlappingMatches, formatDate, draftHours = null,
}: {
  // Point 5 (1.10): an existing match already covers this exact candidate+customer
  // (+location/department) combination — offered as a heads-up, never a block.
  duplicateMatch: ExistingMatchRow | null
  // Point 6 (1.11): the candidate's other ACTIVE matches whose period overlaps
  // this draft's start/end — one line per overlapping match.
  overlappingMatches: ExistingMatchRow[]
  formatDate: (value: string) => string
  // The drafted match's own contracted hours/week (Contract tab), or null while
  // unset — feeds the hours-sum escalation above. Optional/defaulted so a caller
  // that hasn't wired it yet still renders the pre-existing date-only wording.
  draftHours?: number | null
}) {
  const { t } = useTranslation('candidates')
  if (!duplicateMatch && overlappingMatches.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
      {duplicateMatch && (
        <div role="status" style={{ padding: '9px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
          {t('placement.duplicateMatchWarning', { label: labelOf(duplicateMatch) })}
        </div>
      )}
      {overlappingMatches.map(m => {
        const period = m.endDate ? `${formatDate(m.startDate ?? '')} – ${formatDate(m.endDate)}` : t('placement.overlapOngoing', { start: formatDate(m.startDate ?? '') })
        // Both sides carry hours AND their sum exceeds a full-time week → escalate
        // the wording; otherwise (either side unread, or the sum is fine) the
        // existing calm date-only note stands unchanged.
        const hoursSum = overlapHoursSum(draftHours, m.hoursPerWeek)
        return (
          <div key={m.id} role="status" style={{ padding: '9px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
            {hoursSum != null
              ? t('placement.overlapWarningHours', { label: labelOf(m), hours: formatHoursSum(hoursSum), period })
              : t('placement.overlapWarning', { label: labelOf(m), period })}
          </div>
        )
      })}
    </div>
  )
}
