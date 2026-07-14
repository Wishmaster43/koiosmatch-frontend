/**
 * runControl — RUN-CONTROL-1 (stop button + single-flight): the cancel call and
 * the ONE StopRunButton used everywhere a run can be stopped (builder header +
 * run viewer rows), so the control has a single look (§4) and a single API path.
 * POST /workflow-runs/{run}/cancel → cancelled; 422 = the run already finished.
 */
import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Loader2, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Run statuses the backend accepts a cancel for (mirror of the BE guard).
export const CANCELLABLE = new Set(['running', 'waiting'])

// Cancel one run. Resolves on success; rejects with the backend's message
// (e.g. the 422 "already finished") so callers can surface the real reason.
export async function cancelWorkflowRun(runId: string | number): Promise<void> {
  const { default: api } = await import('@/lib/api')
  try {
    await api.post(`/workflow-runs/${runId}/cancel`)
  } catch (err) {
    const e = err as { response?: { data?: { message?: string } }; message?: string }
    throw new Error(e.response?.data?.message ?? e.message ?? '', { cause: err })
  }
}

// The stop button: danger-tinted soft chip (§4 — tint, never a solid fill).
// `compact` renders the icon-only variant for run-viewer rows.
export function StopRunButton({ runId, compact = false, onStopped, onError }: {
  runId: string | number
  compact?: boolean
  onStopped?: () => void
  onError?: (message: string) => void
}) {
  const { t } = useTranslation('workflows')
  const [busy, setBusy] = useState(false)

  // Fire the cancel; report the backend reason (422 on a finished run) upward.
  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      await cancelWorkflowRun(runId)
      onStopped?.()
    } catch (err) {
      onError?.((err as Error).message || t('runControl.stopFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy}
      title={t('runControl.stopTitle')} aria-label={t('runControl.stopTitle')}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        padding: compact ? '4px 8px' : '6px 14px', borderRadius: 8,
        fontSize: compact ? 11 : 12, fontWeight: 500,
        background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
        color: 'var(--color-danger)',
        border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
        cursor: busy ? 'wait' : 'pointer',
      }}>
      {busy ? <Loader2 size={compact ? 10 : 13} className="animate-spin" /> : <Square size={compact ? 10 : 13} fill="currentColor" />}
      {busy ? t('runControl.stopping') : t('runControl.stop')}
    </button>
  )
}
