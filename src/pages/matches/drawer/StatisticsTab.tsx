/**
 * StatisticsTab — MOVED-FROM-OVERVIEW-1 (Danny 22-08, "AKKOORD"): the ordinal
 * footnote ("Match 2 van 2 bij deze kandidaat") that used to sit under the
 * Matchgegevens card on Overview MOVES here, together with the data that makes
 * it useful — WHO/WHAT the other match(es) on that axis actually are. Per axis
 * with data (candidate/client/location/department) this renders a SectionCard
 * titled with the existing ordinal phrase (drawer.ordinal.* — unchanged copy,
 * §11 one source per label) and a compact clickable row per OTHER match on
 * that axis: the other party + vacancy title, a StatusPill (resolved via the
 * same useMatchStatuses lookup OverviewTab/MatchesTable use) and the period
 * when set. STATS-HONEST-1 (mirrors candidates/drawer/StatisticsTab): every
 * number here is DERIVED from allRows (useMatches' full tenant set, the same
 * source MatchDrawer's own `ordinals` memo already reads) — nothing invented.
 * An axis with no id on this match renders nothing (never a fake "1/1", the
 * existing MATCH-ORDINAL-1 rule); an axis with a real ordinal but no OTHER
 * match (total 1) still shows its card, with an italic muted empty note
 * instead of a row. Row click opens that match the same way every other
 * cross-record jump in the app does (openEntity, mirrors ScopedMatchesTab).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import StatusPill from '@/components/ui/StatusPill'
import { BodyText, Caption } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useNavigation } from '@/context/NavigationContext'
import { otherMatchesInAxis } from '../matchOrdinals'
import type { MatchOrdinals } from '../matchOrdinals'
import type { MatchRow } from '@/types/match'

interface StatisticsTabProps {
  match: MatchRow
  // The full tenant match set (useMatches' `rows`) — the source both this
  // match's ordinal position and its axis-mates are derived from.
  allRows: MatchRow[]
  // This match's position/total per axis (MatchDrawer's own memo) — reused
  // here for the card titles instead of recomputing it a second time.
  ordinals: MatchOrdinals
}

// The four axes, in the same order the ordinal footnote used to render them.
const AXES: Array<keyof MatchOrdinals> = ['candidate', 'client', 'location', 'department']

// The OTHER PARTY relative to one axis: the candidate axis groups matches that
// share this candidate, so the useful thing to show per row is who/where they
// went (client) — and vice versa for the client/location/department axes.
function otherPartyOf(axis: keyof MatchOrdinals, row: MatchRow): string {
  return axis === 'candidate' ? row.client : row.candidate
}

export default function StatisticsTab({ match, allRows, ordinals }: StatisticsTabProps) {
  const { t } = useTranslation('matches')
  const { formatDate } = useDateFormat()
  const { metaOf: matchStatusMeta } = useMatchStatuses()
  const { openEntity } = useNavigation()

  // The "other matches" list per axis — computed once per (allRows, match)
  // change, mirroring MatchDrawer's own ordinals memo.
  const othersByAxis = useMemo(
    () => Object.fromEntries(AXES.map(axis => [axis, otherMatchesInAxis(allRows, match, axis)])) as Record<keyof MatchOrdinals, MatchRow[]>,
    [allRows, match],
  )

  const axesWithData = AXES.filter(axis => ordinals[axis])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {axesWithData.length === 0 ? (
        // Honest empty state (§3 four states) — practically only reachable when
        // allRows hasn't loaded this match itself yet.
        <Caption as="div" style={{ fontStyle: 'italic' }}>{t('drawer.statistics.empty')}</Caption>
      ) : axesWithData.map(axis => {
        const ordinal = ordinals[axis]!
        const others = othersByAxis[axis]
        return (
          <SectionCard key={axis} title={t(`drawer.ordinal.${axis}`, { position: ordinal.position, total: ordinal.total })}>
            {others.length === 0 ? (
              <Caption as="div" style={{ fontStyle: 'italic' }}>{t('drawer.statistics.onlyMatch')}</Caption>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {others.map(row => {
                  const meta = matchStatusMeta(row.status)
                  const statusLabel = meta?.label ?? row.stage
                  const period = row.startDate || row.endDate
                    ? `${row.startDate ? formatDate(row.startDate) : '—'} – ${row.endDate ? formatDate(row.endDate) : '—'}`
                    : null
                  return (
                    <button key={row.id} type="button" title={t('drawer.statistics.openMatch')}
                      onClick={() => row.id != null && openEntity('matches', row.id)}
                      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width clickable list row (structural, not an action button), mirrors EntityTasksTab's own row
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px',
                        border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {otherPartyOf(axis, row) || '—'}
                        </BodyText>
                        <Caption as="div" style={{ marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.vacancy || '—'}
                        </Caption>
                      </div>
                      {period && <Caption as="span" style={{ flexShrink: 0 }}>{period}</Caption>}
                      {statusLabel ? (
                        <span style={{ flexShrink: 0 }}><StatusPill label={statusLabel} color={meta?.color ?? row.stageColor} /></span>
                      ) : (
                        <Caption as="span" style={{ flexShrink: 0 }}>—</Caption>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </SectionCard>
        )
      })}
    </div>
  )
}
