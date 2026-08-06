/**
 * MatchConflictBanners — the two calm, non-blocking warnings from the duplicate +
 * overlap preflight (Danny's ten-point round, points 5/6: 1.10/1.11). Both are
 * WARN-only (house rule: never block a create) — an inline note, no button
 * gating. Split out of MatchModal to keep that file a thin container (mirrors
 * RateProposalNotice, which owns its own `useTranslation` rather than taking `t`
 * as a prop — same shape here).
 */
import { useTranslation } from 'react-i18next'
import type { ExistingMatchRow } from './matchConflicts'

// One existing match's display label — vacancy title first, else the client name,
// never a raw id (never surface an internal identifier to the recruiter).
const labelOf = (m: ExistingMatchRow): string => m.vacancyTitle || m.client || '—'

export default function MatchConflictBanners({
  duplicateMatch, overlappingMatches, formatDate,
}: {
  // Point 5 (1.10): an existing match already covers this exact candidate+customer
  // (+location/department) combination — offered as a heads-up, never a block.
  duplicateMatch: ExistingMatchRow | null
  // Point 6 (1.11): the candidate's other ACTIVE matches whose period overlaps
  // this draft's start/end — one line per overlapping match.
  overlappingMatches: ExistingMatchRow[]
  formatDate: (value: string) => string
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
      {overlappingMatches.map(m => (
        <div key={m.id} role="status" style={{ padding: '9px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
          {t('placement.overlapWarning', {
            label: labelOf(m),
            period: m.endDate ? `${formatDate(m.startDate ?? '')} – ${formatDate(m.endDate)}` : t('placement.overlapOngoing', { start: formatDate(m.startDate ?? '') }),
          })}
        </div>
      ))}
    </div>
  )
}
