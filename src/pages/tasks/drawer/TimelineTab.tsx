/**
 * TimelineTab — task's merged timeline feed (GET /tasks/{id}/timeline, §11 X-36).
 * Reuses the shared EventTimeline component, identical to customer timeline rendering.
 * The raw audit changelog (GET /tasks/{id}/activity) stays unchanged on the title-row
 * popover; this tab renders only the merged formatted feed.
 */
import { useTranslation } from 'react-i18next'
import EventTimeline, { type TimelineEvent } from '@/components/ui/EventTimeline'
import { useTaskTimeline } from './hooks/useTaskTimeline'
import type { TaskDetail } from '@/types/task'

export default function TimelineTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation('tasks')
  const { entries, loading, error } = useTaskTimeline(task?.id)

  // Map timeline entries to EventTimeline shape: one event per feed row.
  // The backend sends newest-first (verified in contract), so no re-sorting needed.
  const events: TimelineEvent[] = entries.map(entry => ({
    id: entry.id,
    time: entry.created_at,
    kind: entry.type,
    text: entry.description,
    meta: entry.author ? entry.author : undefined,
  }))

  return (
    <EventTimeline
      events={events}
      loading={loading}
      error={error}
      loadingText={t('timeline.loading')}
      errorText={t('timeline.error')}
      emptyText={t('timeline.empty')}
    />
  )
}
