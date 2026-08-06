import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { resolveGenericLookupIcon } from './lookupIcons'

/**
 * Task (activity) lookups — three tenant-managed lists behind the Tasks feature,
 * each its own Settings sub-tab. All reuse the shared StatusListEditor (name +
 * colour + reorder + 409 in-use), so nothing in the Tasks UI is hardcoded.
 */

// Curated icon subset for activity types — the generic set (task-ish glyphs are
// most of it already), scoped so the picker grid isn't the full 24-icon set.
const TASK_TYPE_ICON_NAMES = ['phone', 'mail', 'message-circle', 'clipboard-list', 'users', 'calendar', 'briefcase', 'check-circle']

/**
 * Task statuses — the board columns. Backend /task-statuses (name + colour +
 * is_done). `is_done` (round-4 audit finding #4) marks the "completed" column so
 * TaskLookupsContext.doneStatusValues (§3, open/overdue/completed KPIs) never
 * matches the editable label by hand — TaskStatusController validates it on both
 * create and update, and it is NOT a HasSingletonFlag (several statuses, e.g.
 * "Done" and "Cancelled", can each count as completed), so it is wired as a plain
 * flagField, not a defaultField singleton.
 */
export function TaskStatusSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('tasks.statusTitle')} subtitle={t('tasks.statusSubtitle')}
        endpoint="/task-statuses" addLabel={t('tasks.statusAdd')}
        flagField={{ key: 'is_done', label: t('tasks.flagDone'), description: t('tasks.flagDoneDesc') }} />
    </div>
  )
}

/** Activity types — the "Activiteit type" lookup. Backend /task-types.
 * `counts_as_contact` (KAND-CONTACT-STEMPELS-1) marks a type whose completed tasks
 * stamp the candidate's last_contact_at; `is_default` (TASKTYPE-DEFAULT-1) is the
 * singleton TaskController assigns to a newly created task with no type — both
 * validated on TaskTypeController::store/update (verified against the backend). */
export function TaskTypeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('tasks.typeTitle')} subtitle={t('tasks.typeSubtitle')}
        endpoint="/task-types" addLabel={t('tasks.typeAdd')}
        iconPicker={{ icons: TASK_TYPE_ICON_NAMES, resolve: resolveGenericLookupIcon }}
        flagField={{ key: 'counts_as_contact', label: t('tasks.typeCountsAsContact'), description: t('tasks.typeCountsAsContactDesc') }}
        defaultField={{ key: 'is_default' }} />
    </div>
  )
}

/** Priorities — Laag/Normaal/Hoog with a colour, and a single default priority
 * (backend TaskPriorityController validates + consumes `is_default`; TaskController
 * assigns it to newly created tasks that don't specify one). */
export function TaskPrioritySettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor title={t('tasks.priorityTitle')} subtitle={t('tasks.prioritySubtitle')}
        endpoint="/task-priorities" addLabel={t('tasks.priorityAdd')}
        defaultField={{ key: 'is_default', labelKey: 'tasks.priorityDefault' }} />
    </div>
  )
}
