/**
 * useAssistActionsExecute — state machine for the shared "Actiepunten" execute
 * flow (promoted from the note domain, CMFE-KOIOS-CONSISTENCY-1, Danny 09-08,
 * §11 one source — notes/useNoteActionsExecute.ts is gone, NoteAssistSection
 * now calls this hook directly through AssistActionsResultsPanel). Two
 * explicit user actions only, never automatic: `preview()` (the "Uitvoeren"
 * button) sends every suggested item unconfirmed and lets the server decide
 * per item (executed now / pending / forbidden, from the caller's Wizard/Auto
 * mode + the rights matrix); `confirm(index)` (a card's own "Bevestigen"
 * button) re-sends ONLY that one item with `confirmed: true` — never the
 * whole batch, so an already-executed sibling is never re-run (§0 no fake
 * affordances, no surprise re-execution).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { extractApiError } from '@/lib/extractApiError'
import { executeRichTextActions, toExecuteItem } from './assistActionsExecuteApi'
import type { ExecuteItemStatus, ExecuteSource } from './assistActionsExecuteApi'
import type { RichTextAssistActionItem } from './richTextAssistApi'

export type PreviewStatus = 'idle' | 'loading' | 'success' | 'error'

// One suggested item + its latest execute outcome (undefined until the first
// preview response arrives) + local in-flight/failure flags for its own card.
export interface ExecItem extends RichTextAssistActionItem {
  status?: ExecuteItemStatus
  run_id?: string
  template_key?: string
  // K-157: the record the sync run created (only linkable id) — null for
  // whatsapp/email/notification items; spread in from the execute response.
  created?: { type: 'appointment' | 'task' | 'calllist'; id: string } | null
  // Server-supplied explanation for a non-executed status (CMBE 5961c673) —
  // spread in from the execute response, rendered by AssistActionItemCard.
  reason?: string
  confirming?: boolean
  confirmError?: boolean
}

// `source` links the batch back to where the items came from — today only an
// existing note (`{ note_id }`); every other host passes nothing (`{}`,
// mirrors a new/unsaved note — an already-proven no-linkage path).
export function useAssistActionsExecute(source: ExecuteSource = {}) {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<ExecItem[] | null>(null)
  const [status, setStatus] = useState<PreviewStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Alive guard (§9): the host can unmount mid-request — never set state after
  // unmount. Re-armed in SETUP (StrictMode runs setup→cleanup→setup in dev).
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  // First pass: send every suggested item, unconfirmed. Only ever called from
  // the "Uitvoeren" button click — nothing runs on its own.
  const preview = useCallback(async (suggested: RichTextAssistActionItem[]) => {
    setStatus('loading'); setErrorMessage('')
    try {
      const results = await executeRichTextActions(suggested.map(it => toExecuteItem(it)), source)
      if (!aliveRef.current) return
      setItems(suggested.map((it, i) => ({
        ...it, ...results[i],
        // K-159: the edit-before-execute fields belong to the USER's item —
        // a server row echoing them empty must never clobber the edit.
        assignee_user_id: it.assignee_user_id, assignee_label: it.assignee_label,
        link_type: it.link_type, link_id: it.link_id, link_label: it.link_label,
      })))
      setStatus('success')
    } catch (err) {
      if (!aliveRef.current) return
      setErrorMessage(extractApiError(err, t('notesAssist.execute.error', { defaultValue: 'Koios kon de acties niet starten.' })))
      setStatus('error')
    }
    // source is a plain object the caller rebuilds each render from a
    // primitive (note_id) — depending on that primitive is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, source.note_id])

  // Per-item confirm — re-sends ONLY that one item with confirmed:true, so an
  // already-executed/forbidden sibling in the same batch is never re-run.
  const confirm = useCallback(async (index: number) => {
    setItems(prev => prev?.map((it, i) => i === index ? { ...it, confirming: true, confirmError: false } : it) ?? null)
    const target = items?.[index]
    if (!target) return
    try {
      const [result] = await executeRichTextActions([toExecuteItem(target, true)], source)
      if (!aliveRef.current) return
      setItems(prev => prev?.map((it, i) => i === index ? { ...it, ...result, confirming: false } : it) ?? null)
    } catch {
      if (!aliveRef.current) return
      setItems(prev => prev?.map((it, i) => i === index ? { ...it, confirming: false, confirmError: true } : it) ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, source.note_id])

  // Back to idle — the "Klaar" close on the results panel; a fresh "Uitvoeren"
  // click starts a new preview from scratch.
  const reset = useCallback(() => { setItems(null); setStatus('idle'); setErrorMessage('') }, [])

  return { items, status, errorMessage, preview, confirm, reset }
}
