import { useTranslation } from 'react-i18next'
import { Block } from '@/pages/dashboard/DashboardPrimitives'
import SoftChip from '@/components/ui/SoftChip'
import { Mono } from '@/components/ui/typography'
import DashboardListRow from '../DashboardListRow'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { TaskDueTodayRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

/**
 * TasksDueTodayList — recruitment work-feed tile: open tasks due today
 * (dash.tasks_due_today). Mirrors WidgetListBlock's row shape via a plain
 * list since the feed row carries a priority chip the shared list doesn't
 * model. Self-hides on an empty feed (handled by the registry's hasData).
 */
export default function TasksDueTodayList({ rows, onNavigate }: {
  rows: TaskDueTodayRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // LOOKUP-I18N-1: the seeded priority label renders in the user's language.
  const seedLabel = useSeedLabel()
  if (!rows.length) return null

  return (
    <Block title={t('block.tasksDueToday')}>
      {rows.map((r, i) => (
        <DashboardListRow key={r.task_id} isLast={i === rows.length - 1}
          onClick={onNavigate ? () => onNavigate('tasks', { open: r.task_id }) : undefined}
          title={r.title || t('widget.unknown')}
          subtitle={r.assignee?.name}
          trailing={
            <>
              {/* Colour carries meaning only — no primary fallback; SoftChip has its own neutral default. */}
              {r.priority && <SoftChip label={seedLabel('taskPriorities', { value: r.priority.value, label: r.priority.label })} color={r.priority.color} />}
              <Mono style={{ flexShrink: 0 }}>{r.due_time || '—'}</Mono>
            </>
          }
        />
      ))}
    </Block>
  )
}
