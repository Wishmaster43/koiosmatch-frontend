import { useTranslation } from 'react-i18next'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import type { Opportunity } from '@/types/opportunity'

/**
 * TasksTab — the tasks linked to this opportunity (Danny 2026-07-06: "taak toevoegen
 * kan niet? lijst oude taken?").
 *
 * Now a thin wrapper over the shared EntityTasksTab (§3A/§11): its whole body was
 * copied verbatim into the contact drawer's Taken tab, so the body moved to
 * components/drawer/tabs and both call sites feed it their own namespace's labels.
 * The bespoke useOpportunityTasks hook (GET /opportunities/{id}/tasks) is gone with
 * it — the generic GET /tasks?opportunity={id} filter now exists for EVERY link type
 * (TASKS-LINK-FILTER-1), so one hook serves them all.
 */
export default function TasksTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')

  return (
    <EntityTasksTab
      linkType="opportunity"
      id={o?.id}
      labels={{
        // TAKEN-TOOLBAR-2: open/history dropped — the shared tab now filters by real
        // task status (StatusFilterSelect), not a hardcoded open/history split.
        newTask: t('tasks.newTask'),
        empty: t('tasks.empty'), loading: t('tasks.loading'), error: t('tasks.error'),
        openTask: t('tasks.openTask'), searchPlaceholder: t('tasks.searchPlaceholder'),
      }}
    />
  )
}
