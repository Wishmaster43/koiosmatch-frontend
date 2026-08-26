/**
 * useEditorExitGuards — owns everything that stands between the user and LEAVING
 * the workflow builder: the unsaved-changes confirm, the live-run confirm, the
 * browser-back history entry (NAV-BACK-BUILDER-1) and the beforeunload warning.
 *
 * Pulled out of WorkflowCanvasEditor (§3) because it is one self-contained
 * concern — its own refs + window listeners, zero rendering — and it was the only
 * imperative block left in an otherwise declarative component. Returns the single
 * `confirmClose` action that the header's X button and a browser-back pop both run,
 * so the guards can never drift apart between those two exits.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export function useEditorExitGuards({ isDirty, liveRunActive, onClose, confirm }: {
  // Live dirty-check from the editor hook (called at click time, not per render).
  isDirty: () => boolean
  liveRunActive: boolean
  onClose: () => void
  // Staged confirmation from the shared useConfirm() — the caller renders its dialog.
  confirm: (message: string, onConfirm: () => void) => void
}) {
  const { t } = useTranslation('workflows')

  // Dirty-check guard (item 19): closing (X) with unsaved changes used to discard
  // them silently — confirm first (via the shared ConfirmDialog). A native
  // beforeunload guard covers the tab close/refresh/navigate-away case the
  // in-app confirm can't catch.
  const confirmClose = () => {
    // RUN-VISIBILITY-1 (Danny 24-07): leaving while a run is LIVE gets an explicit
    // confirm first — honest wording: the run keeps going server-side; stopping is
    // a deliberate act via the Stoppen button, never a side-effect of closing.
    const dirtyGuard = () => {
      if (!isDirty()) { onClose(); return }
      confirm(t('editor.unsavedConfirm'), onClose)
    }
    if (liveRunActive) { confirm(t('editor.liveRunConfirm'), dirtyGuard); return }
    dirtyGuard()
  }

  // NAV-BACK-BUILDER-1 (Danny 24-07, translated: "browser-back does nothing in
  // the builder" — verbatim: "browser-terug doet niets in de builder"):
  // the editor is an overlay in page state, so browser-back only popped the
  // router while the overlay stayed. Push our own history entry on open; a pop
  // re-arms the entry and runs the exact same Close action (incl. the unsaved/
  // live-run guards). A normal close consumes our entry silently.
  const confirmCloseRef = useRef(confirmClose)
  // Keep the ref on the latest closure (guards read live dirty/run state) —
  // assigned in an effect, never during render (lint: no refs in render).
  useEffect(() => { confirmCloseRef.current = confirmClose })
  useEffect(() => {
    // StrictMode-safe (dev double-mount!): only push our entry when it isn't
    // already on top, and NEVER history.back() in cleanup — the async pop there
    // hit the remounted instance and closed the editor the moment it opened
    // (Danny 24-07, translated: "I can no longer click a workflow" — verbatim:
    // "ik kan geen workflow meer aanklikken"). The one leftover
    // entry after a normal close makes the next back a harmless same-page pop.
    if (!(window.history.state as { kmWorkflowEditor?: boolean } | null)?.kmWorkflowEditor) {
      window.history.pushState({ kmWorkflowEditor: true }, '', window.location.href)
    }
    const onPop = () => {
      // Re-arm first so cancelling the confirm keeps the user in the editor.
      window.history.pushState({ kmWorkflowEditor: true }, '', window.location.href)
      confirmCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Warns on a tab close/refresh while there are unsaved changes or a live run,
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // Tab close/refresh: warn on unsaved changes OR a live run (same honesty).
      if (!isDirty() && !liveRunActive) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, liveRunActive])

  return confirmClose
}
