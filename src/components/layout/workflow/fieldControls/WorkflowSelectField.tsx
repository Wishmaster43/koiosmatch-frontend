/**
 * Workflow select field — the workflow_call module's `workflow_id` picker
 * (WF-RELATIONS-1): a searchable list of this tenant's OWN workflows, fed by
 * the same GET /workflows the workflows page list uses (useWorkflowsData) —
 * never a hardcoded/static option list (§3A: every choice list is searchable).
 * Archived workflows are excluded (a soft-deleted child can never actually
 * run); a self-referencing workflow is excluded too (WF-PICKER-SELF-1 — the
 * engine hard-fails on it at run time, §3 no fake affordance);
 * depth/cycle-through-a-third-workflow stays the backend's own guard
 * (WorkflowCallModule), not re-implemented here. Split out of the former fieldControls.tsx monolith (§3 400-line split trigger).
 */
import { useState, useEffect, useContext, useCallback, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { unwrapList } from '@/lib/api'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { CurrentWorkflowContext } from '../contexts'
import type { OnChange } from './types'

// ── Workflow select field ───────────────────────────────────────────────────────
export function WorkflowSelectField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const currentWorkflowId = useContext(CurrentWorkflowContext)
  const [workflows, setWorkflows] = useState<Array<{ value: string; label: string }>>([])
  const [loading,   setLoading]   = useState(true)
  // WF-PICKER-ERROR-1: a failed GET /workflows must read as an honest ERROR, never
  // silently degrade into the "no workflows yet" empty-state copy (§3 four UI states).
  const [error,     setError]     = useState(false)
  const [retryTick, setRetryTick] = useState(0)
  // CreatableSelect's trigger is a <button>, which a plain aria-label cannot
  // name — a sr-only span + aria-labelledby names it instead (§4).
  const workflowLabelId = useId()

  // Loads the other workflows this node can call, excluding archived/deleted ones and the current workflow itself (WF-PICKER-SELF-1); the alive guard drops a stale response if id/retryTick changes first, and a failure surfaces as the honest error state above rather than an empty list.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    import('@/lib/api').then(m => m.default.get('/workflows'))
      .then(r => {
        const rows = unwrapList<Record<string, unknown>>(r).rows
        if (!alive) return
        setWorkflows(rows
          .filter(w => !w.archived && !w.deleted_at)
          .filter(w => currentWorkflowId == null || String(w.id) !== String(currentWorkflowId))
          .map(w => ({ value: String(w.id ?? ''), label: String(w.name ?? w.id ?? '') }))
          .filter(o => o.value))
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [currentWorkflowId, retryTick])

  // Stable retry trigger for the error banner: bumping retryTick re-runs the load effect without needing a new function identity each render.
  const retry = useCallback(() => setRetryTick(n => n + 1), [])

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>{t('fields.workflowLoading')}</div>

  if (error) {
    return <ErrorBanner onRetry={retry}>{t('fields.workflowError')}</ErrorBanner>
  }

  return (
    <>
      <span id={workflowLabelId} className="sr-only">{t('fields.workflowSelect')}</span>
      <CreatableSelect value={(value as string) ?? ''} onChange={v => onChange(fieldKey, v)}
        aria-labelledby={workflowLabelId} allowCreate={false}
        placeholder={workflows.length ? t('fields.workflowSelect') : t('fields.workflowEmpty')}
        options={[
          { value: '', label: workflows.length ? t('fields.workflowSelect') : t('fields.workflowEmpty') },
          ...workflows,
        ]}
        style={{ width: '100%', padding: '7px 9px', fontSize: 13 }} />
    </>
  )
}
