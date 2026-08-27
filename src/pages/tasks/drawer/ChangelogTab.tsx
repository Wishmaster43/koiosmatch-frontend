/**
 * ChangelogTab — the task's field-change audit trail (§3A(d) title-row popover,
 * and now also the LAST timeline tab, §11). Thin wrapper around the shared
 * `components/drawer/tabs/EntityChangelogTab`, replacing the bespoke ActivityTab
 * copy so tasks ride the same GET /tasks/{id}/activity + diff-card rendering as
 * every other entity's changelog.
 */
import EntityChangelogTab, { type ChangelogEvent } from '@/components/drawer/tabs/EntityChangelogTab'
import { useTaskActivity } from '../hooks/useTaskActivity'
import type { TaskDetail } from '@/types/task'


// Task drawer's changelog tab content.
export default function ChangelogTab({ task }: { task: TaskDetail }) {
  const { items, loading, error } = useTaskActivity(task?.id)
  return (
    <EntityChangelogTab
      items={items as ChangelogEvent[]}
      loading={loading}
      error={error}
      namespace="tasks"
    />
  )
}
