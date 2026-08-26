/**
 * VacancyTasksTab — the vacancy's own "Taken" tab (V-tasks-1: the candidate drawer
 * already has one, the vacancy drawer did not). Data + toolbar shape mirror the
 * candidate tasks surface exactly, but through the shared `EntityTasksTab` shell
 * (§3A: extend, never fork) — the same component + `useEntityTasks` hook already
 * used by customers/departments/locations/contacts/opportunities. `linkType="vacancy"`
 * is a real, working filter: TaskLinkResolver::types() (measured 2026-07-28,
 * TASKS-LINK-FILTER-1) generates a query param per link token straight from the
 * backend's own resolver, and 'vacancy' is one of the listed tokens — so this tab
 * requests only tasks actually linked to this vacancy, never the full tenant list.
 */
import { useTranslation } from 'react-i18next'
import EntityTasksTab from '@/components/drawer/tabs/EntityTasksTab'
import type { VacancyDetail } from '@/types/vacancy'

// See the file's top doc above; thin wrapper over the shared EntityTasksTab scoped to this vacancy link type.
export default function VacancyTasksTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  return (
    <EntityTasksTab linkType="vacancy" id={v.id}
      labels={{
        newTask: t('tasks.newTask'),
        searchPlaceholder: t('tasks.searchPlaceholder'),
        empty: t('tasks.empty'),
        loading: t('tasks.loading'),
        error: t('tasks.error'),
        openTask: t('tasks.openTask'),
      }}
    />
  )
}
