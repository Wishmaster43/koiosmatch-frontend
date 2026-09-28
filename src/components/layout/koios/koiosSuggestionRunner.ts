/**
 * koiosSuggestionRunner — pure helpers + the useRun hook shared by the staged/
 * confirm leg (golf 3). Split out of KoiosSuggestionExec so that file only
 * exports React components (react-refresh/only-export-components); behaviour
 * is UNCHANGED by KOIOS-SUGGEST-COMPACT-1.
 */
import { useTranslation } from 'react-i18next'
import { createdRefFromToolResult } from './koiosToolResult'
import { extractApiError } from '@/lib/extractApiError'
import type { KoiosPreviewRow } from './koiosTypes'
import type { KoiosContextRef } from '@/types/koios'
import type { ActionBudget } from '@/types/actionBudget'

// A preview row's user-facing line; raw id rows (kandidaat_id: <uuid>) are the
// chip's job and never read as text.
export const previewLine = (row: KoiosPreviewRow) => row.before != null || row.after != null
  ? `${row.label} · ${row.before ?? '—'} → ${row.after ?? '—'}`
  : `${row.label}${row.text ? `: ${row.text}` : ''}`
export const isIdRow = (row: KoiosPreviewRow) => /_id$/i.test(row.label)

export type StagedAction = { id: string; title?: string; preview?: KoiosPreviewRow[]; expires_at?: string }
export type ExecState = {
  phase: 'idle' | 'staging' | 'staged' | 'submitting' | 'executed' | 'cancelled' | 'error'
  message?: string; staged?: StagedAction; created?: KoiosContextRef | null; budget?: ActionBudget
}
export type NavigateHint = { type?: string; id?: string; tab?: string } | null | undefined

// Confirm/cancel share the shape: submit → server verdict (SERVER truth, not HTTP truth).
export function useRun(setExec: (s: ExecState) => void, onDone?: (navigate?: NavigateHint) => void) {
  const { t } = useTranslation('common')
  return async (id: string, call: (id: string) => Promise<{ status?: string; message?: string; data?: unknown }>, done: 'executed' | 'cancelled', fallbackLabel?: string) => {
    setExec({ phase: 'submitting', staged: undefined })
    try {
      const body = await call(id)
      if (body?.status === done) {
        setExec({ phase: done, created: done === 'executed' ? createdRefFromToolResult(body.data, fallbackLabel ?? t('koios.assistant.createdTask')) : null })
        onDone?.(done === 'executed' ? (body.data as { navigate?: NavigateHint } | undefined)?.navigate : undefined)
      } else {
        setExec({ phase: 'error', message: body?.message ?? t('koios.pendingAction.error') })
      }
    } catch (err) {
      const errBody = (err as { response?: { data?: { data?: { budget?: ActionBudget } } } })?.response?.data
      setExec({ phase: 'error', message: extractApiError(err, t('koios.pendingAction.error')), budget: errBody?.data?.budget })
    }
  }
}
