/**
 * useWorkflowRunViewer: fetch ONE workflow run by id and hold it for the shared RunDetailDrawer.
 * Extracted from AssistActionsResultsPanel (MANUAL-START-WORKFLOW-1, Danny 23-11 Q16) so the
 * conversation bubble's run link and the assist panel open the SAME drawer through one fetch
 * path (§3A reuse, never a second hand-built run view).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchWorkflowRun } from '@/components/ui/richtext/assistActionsExecuteApi'
import { notifyError } from '@/lib/notify'
import type { RunRow } from '@/types/reports'

// Holds the run being inspected (null = drawer closed) and the fetch state of the click.
export function useWorkflowRunViewer() {
  const { t } = useTranslation('common')
  const [viewingRun, setViewingRun] = useState<RunRow | null>(null)
  const [runLoading, setRunLoading] = useState(false)

  // Fetch the single run row (callers only hold the id) and open it; a failed fetch toasts,
  // so the click never silently does nothing.
  const viewRun = async (runId: string) => {
    setRunLoading(true)
    try {
      setViewingRun(await fetchWorkflowRun(runId))
    } catch {
      notifyError(t('common:errorGeneric'))
    } finally {
      setRunLoading(false)
    }
  }

  // Closes the drawer.
  const closeRun = () => setViewingRun(null)

  return { viewingRun, runLoading, viewRun, closeRun }
}
