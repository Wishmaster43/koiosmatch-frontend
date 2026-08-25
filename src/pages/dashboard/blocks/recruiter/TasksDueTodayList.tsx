/**
 * TasksDueTodayList — recruitment work-feed tile: open tasks due today
 * (dash.tasks_due_today). Mirrors WidgetListBlock's row shape via a plain
 * list since the feed row carries a priority chip the shared list doesn't
 * model. Self-hides on an empty feed (handled by the registry's hasData).
 */
import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import SoftChip from '@/components/ui/SoftChip'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { interactive } from '@/lib/a11y'
import type { TaskDueTodayRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function TasksDueTodayList({ rows, onNavigate }: {
  rows: TaskDueTodayRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  if (!rows.length) return null

  return (
    <Block title={t('block.tasksDueToday')}>
      {rows.map((r, i) => (
        <div key={r.task_id} {...interactive(onNavigate ? () => onNavigate('tasks', { open: r.task_id }) : undefined)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: onNavigate ? 'pointer' : 'default',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <BodyText as="div" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.title || t('widget.unknown')}
            </BodyText>
            {r.assignee?.name && (
              <Caption as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.assignee.name}</Caption>
            )}
          </div>
          {/* Colour carries meaning only — no primary fallback; SoftChip has its own neutral default. */}
          {r.priority && <SoftChip label={r.priority.label} color={r.priority.color} />}
          <Mono style={{ flexShrink: 0 }}>{r.due_time || '—'}</Mono>
        </div>
      ))}
    </Block>
  )
}
