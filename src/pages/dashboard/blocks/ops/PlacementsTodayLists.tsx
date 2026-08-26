/**
 * PlacementsTodayLists — ops tile: matches starting/ending today
 * (dash.placements_started_ended_today), rendered as two labelled sub-lists in
 * the WidgetListBlock row idiom inside one Block. A sub-list with no rows
 * renders nothing (no fabricated empty state); the whole tile self-hides when
 * both are empty (index.tsx's custom hasData).
 */
import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import { GroupLabel, BodyText, Caption } from '@/components/ui/typography'
import { interactive } from '@/lib/a11y'
import type { PlacementsStartedEndedToday, PlacementTodayRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// One sub-list (Started or Ended) — rows in the shared WidgetListBlock row layout.
function TodaySubList({ label, rows, onNavigate }: {
  label: string
  rows: PlacementTodayRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  if (!rows.length) return null
  return (
    <div>
      <GroupLabel style={{ padding: '10px 16px 4px' }}>{label}</GroupLabel>
      {rows.map((r, i) => (
        <div key={r.match_id}
          // Only wired when onNavigate is actually provided, so a row doesn't render clickable for nothing.
          {...(onNavigate ? interactive(() => onNavigate('matches', { open: r.match_id })) : {})}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: onNavigate ? 'pointer' : 'default',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.candidate || r.customer || t('widget.unknown')}
            </BodyText>
            {r.candidate && r.customer && (
              <Caption as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customer}</Caption>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Two labelled sub-lists (started/ended today); the whole tile self-hides when both are empty.
export default function PlacementsTodayLists({ feed, onNavigate }: {
  feed: PlacementsStartedEndedToday
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // Defence in depth: self-hide when both sub-lists are empty, mirroring CouplingErrorsList/DocumentsAttentionTable.
  if (!feed.started.length && !feed.ended.length) return null
  return (
    <Block title={t('block.placementsStartedEndedToday')}>
      <TodaySubList label={t('feed.started')} rows={feed.started} onNavigate={onNavigate} />
      <TodaySubList label={t('feed.ended')} rows={feed.ended} onNavigate={onNavigate} />
    </Block>
  )
}
