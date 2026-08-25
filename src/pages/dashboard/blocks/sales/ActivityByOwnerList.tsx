/**
 * ActivityByOwnerList — sales_manager tile: activity count per owner, from
 * dash.activity_by_owner. Mirrors the RecruiterLoad idiom (avatar + name +
 * Mono count + relative load bar). Rows with zero activity still render (a
 * manager wants to see who did nothing), just without a caption chip. Rows
 * with a real owner id are clickable (opportunities page now filters by
 * owner id); the null-owner (unassigned) row stays inert — there is no id to
 * narrow on.
 */
import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import Avatar from '@/components/ui/Avatar'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { initialsOf } from '@/lib/initials'
import { interactive } from '@/lib/a11y'
import type { ActivityByOwnerRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function ActivityByOwnerList({ rows, onNavigate }: {
  rows: ActivityByOwnerRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  if (!rows.length) return null

  // The bar scales against the busiest owner — a share, not an absolute.
  const top = rows.reduce((m, r) => Math.max(m, r.activity), 0)

  return (
    <Block title={t('block.activityByOwner')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 16px' }}>
        {rows.map(r => {
          const pct = top > 0 ? Math.round((r.activity / top) * 100) : 0
          const name = r.owner_id == null ? t('feed.unassigned') : (r.name || t('widget.unknown'))
          // Inert for the unassigned (null owner) row — there is no owner id to filter on.
          const onClick = r.owner_id != null ? () => onNavigate?.('opportunities', { owner: r.owner_id }) : undefined
          return (
            <div key={r.owner_id ?? 'none'} style={onClick ? { cursor: 'pointer' } : undefined} {...interactive(onClick)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar initials={initialsOf(name, '–')} size={22} soft />
                <BodyText as="span" style={{ flex: 1, minWidth: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </BodyText>
                <Mono style={{ fontVariantNumeric: 'tabular-nums' }}>{r.activity}</Mono>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--hover-bg)', overflow: 'hidden', marginBottom: 5 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--button-fill)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <Caption as="span">{t('feed.activityCount', { count: r.activity })}</Caption>
            </div>
          )
        })}
      </div>
    </Block>
  )
}
