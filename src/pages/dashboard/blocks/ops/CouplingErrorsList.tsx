import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import { BodyText, Caption } from '@/components/ui/typography'
import { interactive } from '@/lib/a11y'
import { useDateFormat } from '@/lib/datetime'
import type { CouplingErrorRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Known entity types → the page that owns their drawer. An unmapped type keeps the row inert.
const ENTITY_PAGE: Record<string, string> = {
  candidate: 'candidates',
  customer: 'customers',
  match: 'matches',
  vacancy: 'vacancies',
}

/**
 * CouplingErrorsList — ops tile: records that failed to sync to an external
 * system (dash.coupling_errors_list). Each row deep-links to the source
 * record's own page when the entity type is a known one; an unknown
 * entity_type renders inert (no target to route to).
 */
export default function CouplingErrorsList({ rows, onNavigate }: {
  rows: CouplingErrorRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDateTime } = useDateFormat()
  if (!rows.length) return null

  return (
    <Block title={t('block.couplingErrorsList')}>
      {rows.map((r, i) => {
        const page = ENTITY_PAGE[r.entity_type]
        const onClick = page && onNavigate ? () => onNavigate(page, { open: r.entity_id }) : undefined
        const secondary = t(`feed.system.${r.system}`) + (r.error ? `: ${r.error}` : '')
        return (
          <div key={`${r.entity_type}-${r.entity_id}`} {...interactive(onClick)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: onClick ? 'pointer' : 'default',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.entity_label || t('widget.unknown')}
              </BodyText>
              <Caption as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</Caption>
            </div>
            <Caption style={{ flexShrink: 0 }}>{r.synced_at ? formatDateTime(r.synced_at) : '—'}</Caption>
          </div>
        )
      })}
    </Block>
  )
}
