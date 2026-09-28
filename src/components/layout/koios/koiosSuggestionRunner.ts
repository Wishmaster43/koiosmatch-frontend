/**
 * koiosSuggestionRunner — pure helpers + the useRun hook shared by the staged/
 * confirm leg (golf 3). Split out of KoiosSuggestionExec so that file only
 * exports React components (react-refresh/only-export-components); behaviour
 * is UNCHANGED by KOIOS-SUGGEST-COMPACT-1. RESCHEDULE-EDIT-1 (Danny 29-09)
 * adds the `editing` phase (an action whose input the user adjusts before it
 * ever reaches the server) and `useStageAndConfirm`, which folds the stage →
 * confirm round trip into ONE user step for that edited input.
 */
import { useTranslation } from 'react-i18next'
import { createdRefFromToolResult } from './koiosToolResult'
import { extractApiError } from '@/lib/extractApiError'
import { useNavigation } from '@/context/NavigationContext'
import { pageForResultRef } from './koiosResultLinks'
import { TOOL_FOLLOW_UP } from './koiosSuggestionMeta'
import { canonicalToolId } from './koiosToolIds'
import type { KoiosPreviewRow } from './koiosTypes'
import type { KoiosContextRef } from '@/types/koios'
import type { ActionBudget } from '@/types/actionBudget'
import type { KoiosAssistantAction, KoiosAssistantSuggestion } from './useKoiosAssistant'

// A preview row's user-facing line; raw id rows (kandidaat_id: <uuid>) are the
// chip's job and never read as text.
export const previewLine = (row: KoiosPreviewRow) => row.before != null || row.after != null
  ? `${row.label} · ${row.before ?? '—'} → ${row.after ?? '—'}`
  : `${row.label}${row.text ? `: ${row.text}` : ''}`
export const isIdRow = (row: KoiosPreviewRow) => /_id$/i.test(row.label)

export type StagedAction = { id: string; title?: string; preview?: KoiosPreviewRow[]; expires_at?: string }
export type ExecState = {
  phase: 'idle' | 'editing' | 'staging' | 'staged' | 'submitting' | 'executed' | 'cancelled' | 'error'
  message?: string; staged?: StagedAction; created?: KoiosContextRef | null; budget?: ActionBudget
  // The action the user is adjusting before it stages (RESCHEDULE-EDIT-1) — only set while `phase === 'editing'`.
  editingAction?: KoiosAssistantAction
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

// RESCHEDULE-EDIT-1 (verifier fix): the executed-action landing spot, shared by
// both the row-level `run` (reschedule editor path) and SuggestionActions' own
// `run` (staged/confirm path) — a single record-of-truth so neither path can
// drop the server's `data.navigate` hint or the tool's follow-up tab (KOIOS-ROW-2).
export function useLandAfterExecute(suggestion: KoiosAssistantSuggestion) {
  const { openEntity } = useNavigation()
  return (navigate?: NavigateHint) => {
    const hint = navigate?.type && navigate.id ? navigate : undefined
    const choices = suggestion.actions?.length ? suggestion.actions : suggestion.action ? [suggestion.action] : []
    const lead = choices[0]
    const follow = lead ? TOOL_FOLLOW_UP[canonicalToolId(lead.tool)] : undefined
    const ref = hint ? { type: hint.type!, id: hint.id!, tab: hint.tab } : follow ? (() => {
      const r = suggestion.refs.find(x => x.type === follow.refType)
      return r ? { type: r.type, id: r.id, tab: follow.tab } : undefined
    })() : undefined
    const page = ref ? pageForResultRef(ref.type) : null
    if (ref && page) openEntity(page, ref.id, ref.tab)
  }
}

// RESCHEDULE-EDIT-1: stage the (possibly user-edited) input and, on success,
// confirm it immediately with `run` — one user click covers both server round
// trips, never a second "Confirm" click on top of the editor's own button.
export function useStageAndConfirm(setExec: (s: ExecState) => void, run: ReturnType<typeof useRun>) {
  const { t } = useTranslation('common')
  return async (
    stageFn: (tool: string, input: Record<string, unknown>) => Promise<{ status?: string; action?: StagedAction; message?: string }>,
    confirmFn: (id: string) => Promise<{ status?: string; message?: string; data?: unknown }>,
    tool: string,
    input: Record<string, unknown>,
  ) => {
    // 'staging' (not 'submitting'): SuggestionActions only disables/spins the
    // primary button on 'staging' — 'submitting' with no `staged` would instead
    // unmount the editor and re-show the enabled action buttons mid-request.
    setExec({ phase: 'staging' })
    try {
      const body = await stageFn(tool, input)
      if (body?.status === 'staged' && body?.action?.id) {
        await run(body.action.id, confirmFn, 'executed', body.action.title)
      } else {
        setExec({ phase: 'error', message: body?.message ?? t('koios.pendingAction.error') })
      }
    } catch (err) {
      setExec({ phase: 'error', message: extractApiError(err, t('koios.pendingAction.error')) })
    }
  }
}
