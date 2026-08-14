import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isTaskOverdue } from '@/pages/tasks/data/mapTask'
import type { KoiosAdvice } from '@/lib/koiosAdviceMeta'
import type { Task } from '@/types/task'

/**
 * useTaskAdvice — the ONE resolver both the tasks TABLE column and the drawer's
 * Koios block call, so they can never disagree (KOIOS-ADVIES-OVERAL-1, mirrors
 * useCandidateAdvice). Reuses the SAME isTaskOverdue() the due-date cell
 * colours red, so the two can never diverge (Danny's own example rule:
 * "taak: over tijd → Te laat").
 */
export function useTaskAdvice(): (r: Task) => KoiosAdvice | null {
  const { t } = useTranslation('tasks')

  // Stable identity: the table's memoized columns depend on this resolver.
  return useCallback((r: Task): KoiosAdvice | null => {
    if (!isTaskOverdue(r)) return null
    return {
      action: 'overdue',
      label: t('common:koios.actions.overdue', { defaultValue: 'Overdue' }),
      reason: t('koios.reasons.overdue'),
      source: 'rules',
    }
  }, [t])
}
