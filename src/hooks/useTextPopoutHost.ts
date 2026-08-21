/**
 * useTextPopoutHost — the OPENER side of a popped-out free-text field
 * (TEKST-POPOUT-1, Danny 08-08 punt 2). A host screen keeps owning its own value
 * and edit state; this hook only adds the second-screen plumbing: open the window,
 * join the sync channel, answer a fresh window's `hello` with the current draft,
 * and hand incoming draft/saved messages back to the host.
 *
 * Why a hook and not inline in the tab: the candidate drill-down is a FROZEN
 * screen (Danny 08-08) — the visible change there must stay one icon button, and
 * every entity that mirrors this next (customer/vacancy description) reuses this
 * hook instead of copying the wiring (§3 logic-in-hooks, §11 no second copy).
 *
 * The channel is off until the field is actually popped out, so a drawer that
 * nobody pops out opens no BroadcastChannel at all.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError } from '@/lib/notify'
import { openTextPopout, textPopoutTopic } from '@/lib/secondScreen'
import type { PopoutEntity, PopoutTextField } from '@/lib/secondScreen'
import { useTextPopoutSync } from './useTextPopoutSync'
import { useDrawerPopoutRegistry } from '@/components/drawer/DrawerPopoutRegistry'

interface TextPopoutHostOptions {
  entity: PopoutEntity
  id: string | number
  field: PopoutTextField
  // The host's CURRENT draft — replayed to a window that just opened.
  value: string
  // Whether that draft is UNSAVED. It decides how the replay is labelled, so a
  // window that opens on already-persisted text does not claim unsaved changes.
  dirty: boolean
  // The other window is typing: adopt the text (host stays/goes into edit mode).
  onDraft: (html: string) => void
  // The other window persisted the field: adopt the value, drop the edit state.
  onSaved: (html: string) => void
}

export function useTextPopoutHost({ entity, id, field, value, dirty, onDraft, onSaved }: TextPopoutHostOptions) {
  const { t } = useTranslation('common')
  // Null outside any drawer (modal hosts) — then no auto-close, today's behaviour.
  const registry = useDrawerPopoutRegistry()
  // Joined only after the user pops the field out (see `open` below).
  const [active, setActive] = useState(false)
  // Latest draft + its saved state for the `hello` reply — refs so the message
  // handler never answers with a stale closure; assigned in an effect, not in render.
  const valueRef = useRef(value)
  const dirtyRef = useRef(dirty)
  useEffect(() => { valueRef.current = value; dirtyRef.current = dirty })


  const post = useTextPopoutSync({
    topic: textPopoutTopic(entity, id, field),
    enabled: active,
    onMessage: message => {
      // A window just opened: replay our text, labelled honestly — an unsaved
      // draft as `draft`, otherwise as the persisted `saved` value.
      if (message.kind === 'hello') { post({ kind: dirtyRef.current ? 'draft' : 'saved', html: valueRef.current }); return }
      if (message.kind === 'draft') { onDraft(message.html); return }
      onSaved(message.html)
    },
  })

  // Open (or re-focus) the second-screen window; a blocked popup gets an honest
  // notice through the central error path instead of failing silently (§3).
  const open = useCallback(() => {
    setActive(true)
    const win = openTextPopout(entity, id, field)
    if (!win) { notifyError(t('popupBlocked')); return }
    // KLANTEN 5 (rebuilt after verify-round REJECT): the window joins the
    // DRAWER's registry, so it closes when the drawer really closes — never on
    // a mere tab switch (the host unmounts on every switch; a host-scoped
    // close destroyed the second screen and its unsaved text on nine hosts).
    registry?.register(win)
  }, [entity, id, field, t, registry])

  // Mirror one local edit (typing, dictation, Koios assist) to the other window.
  const publishDraft = useCallback((html: string) => post({ kind: 'draft', html }), [post])

  return { open, publishDraft, active }
}
