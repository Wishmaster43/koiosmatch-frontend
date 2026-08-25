/**
 * StatisticsTab — the "Kans X van Y bij deze klant" ordinal for the opportunity
 * drawer, together with the OTHER opportunities at that same customer (mirrors
 * matches/drawer/StatisticsTab.tsx, STATS-HONEST-1): every number here is
 * DERIVED from allRows (the page's already-loaded tenant set, useOpportunitiesData's
 * `rows`), nothing invented. A deal with no clientId renders the honest empty
 * state (never a fake "1/1"); a deal whose customer has no OTHER opportunity
 * still shows the card, with an italic muted empty note instead of a row. Row
 * click opens that opportunity the same way every other cross-record jump in
 * the app does (openEntity, mirrors matches/drawer/StatisticsTab's own row).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import StatusPill from '@/components/ui/StatusPill'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useNavigation } from '@/context/NavigationContext'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { computeOpportunityOrdinal, otherOpportunitiesForClient } from '../opportunityOrdinals'
import { opportunityValueOf, formatOpportunityValue } from '../data/opportunityValue'
import type { Opportunity } from '@/types/opportunity'

interface StatisticsTabProps {
  opportunity: Opportunity
  // The full tenant opportunity set (useOpportunitiesData's `rows`) — the source
  // both this deal's ordinal position and its customer-mates are derived from.
  allRows: Opportunity[]
  // Tenant setting: show the deal magnitude in hours instead of euro (mirrors the table).
  valueInHours?: boolean
}

export default function StatisticsTab({ opportunity, allRows, valueInHours = false }: StatisticsTabProps) {
  const { t } = useTranslation('opportunities')
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  // LOOKUP-I18N-1: the seeded stage label renders in the user's language.
  const seedLabel = useSeedLabel()

  // This deal's position among the customer's other deals + the peer list —
  // computed once per (allRows, opportunity) change, mirroring MatchDrawer's own memo.
  const ordinal = useMemo(() => computeOpportunityOrdinal(allRows, opportunity), [allRows, opportunity])
  const others  = useMemo(() => otherOpportunitiesForClient(allRows, opportunity), [allRows, opportunity])

  if (!ordinal) {
    // Honest empty state (§3 four states) — no customer linked on this deal yet.
    return <Caption as="div" style={{ fontStyle: 'italic' }}>{t('drawer.statistics.empty')}</Caption>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionCard title={t('drawer.ordinal.client', { position: ordinal.position, total: ordinal.total })}>
        {others.length === 0 ? (
          <Caption as="div" style={{ fontStyle: 'italic' }}>{t('drawer.statistics.onlyOpportunity')}</Caption>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {others.map(row => {
              const v = opportunityValueOf(row, valueInHours)
              return (
                <button key={row.id} type="button" title={t('drawer.statistics.openOpportunity')}
                  onClick={() => row.id != null && openEntity('opportunities', row.id)}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width clickable list row (structural, not an action button), mirrors matches/drawer/StatisticsTab's own row
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px',
                    border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.title || '—'}
                    </BodyText>
                    <Caption as="div" style={{ marginTop: 1 }}>
                      {row.expectedCloseAt ? formatDate(row.expectedCloseAt) : '—'}
                    </Caption>
                  </div>
                  {/* Value/unit — same shared formatter the table + customer drawer tab use (§11).
                      Caption owns the muted 11px identity, Mono nested inside owns the font (§4 atoms). */}
                  <Caption as="span" style={{ flexShrink: 0 }}>
                    <Mono as="span">{v == null ? '—' : formatOpportunityValue(row, valueInHours, t)}</Mono>
                  </Caption>
                  {row.stage ? (
                    <span style={{ flexShrink: 0 }}><StatusPill label={seedLabel('opportunityStages', { label: row.stage })} color={row.stageColor} /></span>
                  ) : (
                    <Caption as="span" style={{ flexShrink: 0 }}>—</Caption>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
