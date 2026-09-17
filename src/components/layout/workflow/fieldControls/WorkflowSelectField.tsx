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
import { useContext, useId } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { CurrentWorkflowContext } from '../contexts'
import { useLookupOptions } from './useLookupOptions'
import type { OnChange } from './types'

// ── Workflow select field ───────────────────────────────────────────────────────
export function WorkflowSelectField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const currentWorkflowId = useContext(CurrentWorkflowContext)
  // CreatableSelect's trigger is a <button>, which a plain aria-label cannot
  // name — a sr-only span + aria-labelledby names it instead (§4).
  const workflowLabelId = useId()

  // Loads the other workflows this node can call via the shared lookup harness
  // (alive-guard + error/retry, D1 dedup), excluding archived/deleted ones and
  // the current workflow itself (WF-PICKER-SELF-1); a failure surfaces as the
  // honest error state below rather than an empty list.
  const { opts: workflows, error, loading, retry } = useLookupOptions<{ value: string; label: string }>(
    '/workflows',
    w => {
      if (w.archived || w.deleted_at) return null
      if (currentWorkflowId != null && String(w.id) === String(currentWorkflowId)) return null
      const optValue = String(w.id ?? '')
      if (!optValue) return null
      return { value: optValue, label: String(w.name ?? w.id ?? '') }
    },
    [currentWorkflowId],
  )

  if (error) {
    return <ErrorBanner onRetry={retry}>{t('fields.workflowError')}</ErrorBanner>
  }

  // While the GET is in flight, show the loading copy — never the empty-state
  // copy, which would misread a pending load as an honest "no workflows" (D8).
  if (loading) {
    return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('fields.workflowLoading')}</span>
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
