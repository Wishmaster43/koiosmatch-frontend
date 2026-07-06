import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Task (activity) lookups — three tenant-managed lists behind the Tasks feature,
 * each its own Settings sub-tab. All reuse the shared StatusListEditor (name +
 * colour + reorder + 409 in-use), so nothing in the Tasks UI is hardcoded.
 */

/** Task statuses — the board columns. Backend /task-statuses (name + colour + is_done). */
export function TaskStatusSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('tasks.statusTitle')} subtitle={t('tasks.statusSubtitle')}
        endpoint="/task-statuses" addLabel={t('tasks.statusAdd')} />
    </div>
  )
}

/** Activity types — the "Activiteit type" lookup. Backend /task-types. */
export function TaskTypeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('tasks.typeTitle')} subtitle={t('tasks.typeSubtitle')}
        endpoint="/task-types" addLabel={t('tasks.typeAdd')} withIcon />
    </div>
  )
}

/** Priorities — Laag/Normaal/Hoog with a colour. Backend /task-priorities. */
export function TaskPrioritySettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('tasks.priorityTitle')} subtitle={t('tasks.prioritySubtitle')}
        endpoint="/task-priorities" addLabel={t('tasks.priorityAdd')} />
    </div>
  )
}
