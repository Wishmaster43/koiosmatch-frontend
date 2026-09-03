/**
 * MatchRenewalsBlock — render the renewal history chain for a match
 * (MATCH-RENEWAL-1). Displays each renewal as a compact row: sequence,
 * old_end_date → new_end_date (DD-MM-YYYY), with the date and user who
 * created it shown below. Only renders when renewals.length > 0 (canon:
 * never show an empty block).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { useDateFormat } from '@/lib/datetime'
import { useUsers } from '@/lib/queries'
import type { MatchRenewal } from '@/types/match'
import { Caption } from '@/components/ui/typography'

interface MatchRenewalsBlockProps {
  renewals: MatchRenewal[]
}

// Map user id → name; cache so repeated renders don't spam the lookups.
function useUserNames() {
  const { data: users = [] } = useUsers() as { data?: Array<{ id: string | number; name: string }> }
  return useMemo(() => {
    const map = new Map<string | number, string>()
    users.forEach(u => { if (u.id && u.name) map.set(String(u.id), u.name) })
    return map
  }, [users])
}

export default function MatchRenewalsBlock({ renewals }: MatchRenewalsBlockProps) {
  const { t } = useTranslation('matches')
  const { formatDate } = useDateFormat()
  const userNames = useUserNames()

  // Only render when there's actual data (canon: never an empty block).
  if (!renewals || renewals.length === 0) return null

  return (
    <SectionCard title={t('drawer.contract.renewals')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {renewals.map((renewal, idx) => {
          // User name resolution — fall back to nothing, never a raw id (§3B).
          const createdByName = renewal.created_by
            ? userNames.get(String(renewal.created_by)) ?? null
            : null

          return (
            <div key={renewal.id ?? idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Label-left / value-right (DRILLDOWN-VOLGORDE-CANON): sequence + date range. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
                <span style={CANON_LABEL_STYLE}>
                  #{renewal.sequence ?? idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', wordBreak: 'break-word' }}>
                  {renewal.old_end_date && renewal.new_end_date
                    ? `${formatDate(renewal.old_end_date)} → ${formatDate(renewal.new_end_date)}`
                    : '—'}
                </div>
              </div>
              {/* Metadata row: created date + user name (Caption style). */}
              {(renewal.created_at || createdByName) && (
                <Caption as="div" style={{ marginLeft: CANON_LABEL_STYLE.width as number }}>
                  {renewal.created_at ? formatDate(renewal.created_at) : '—'}
                  {createdByName && (
                    <>
                      {' · '}
                      {createdByName}
                    </>
                  )}
                </Caption>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
