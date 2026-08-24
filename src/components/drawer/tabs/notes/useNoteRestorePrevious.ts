/**
 * useNoteRestorePrevious — NOTE-UNDO-FE-1 (K-172): peek the note's one-slot undo
 * and stage the shared confirm dialog with the previous text as a preview.
 * Pulled out of NotesTab.tsx (§3 hard cap — the file crossed the 400-line split
 * trigger the moment this landed inline) so the shared tab stays a thin renderer.
 *
 * `restoringIdx` guards the icon against a second click while the peek is in
 * flight — a note's PATCH history is not local state the UI can predict, so
 * every click re-fetches. A 422 (no slot, or the guard the backend already
 * enforces on update()) degrades to a calm info toast, never a red error
 * banner — restoring nothing is an expected, recoverable outcome here, not a
 * failure (§13 tests pin this on the confirming hooks).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { notify } from '@/lib/notify'
import type { NotePreviousVersion } from '../NotesTab'

const unavailable = (t: TFunction) => t('notes.restoreUnavailable', { defaultValue: 'There is no previous version to restore.' })

interface Options {
  onFetchPreviousVersion?: (i: number) => Promise<NotePreviousVersion | null>
  onRestorePreviousNote?: (i: number) => Promise<boolean>
  // Stages the shared ConfirmDialog (useConfirm) — signature mirrors its own `confirm()`.
  confirm: (message: string, onConfirm: () => void, options?: { title?: string; children?: ReactNode }) => void
  formatDate: (v: string, opts?: Record<string, string>) => string
  t: TFunction
  restoreConfirmTitle?: string
  // Renders the previous-text preview (SafeHtml, never raw-injected) inside the dialog.
  renderPreview: (html: string) => ReactNode
}

export function useNoteRestorePrevious({ onFetchPreviousVersion, onRestorePreviousNote, confirm, formatDate, t, restoreConfirmTitle, renderPreview }: Options) {
  const [restoringIdx, setRestoringIdx] = useState<number | null>(null)

  const requestRestorePrevious = (i: number) => {
    if (!onFetchPreviousVersion || restoringIdx != null) return
    setRestoringIdx(i)
    onFetchPreviousVersion(i)
      .then(preview => {
        if (!preview || preview.previous_body == null) { notify('info', unavailable(t)); return }
        const savedAt = preview.previous_saved_at
          ? formatDate(preview.previous_saved_at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : ''
        confirm(
          savedAt
            ? t('notes.restoreConfirm', { date: savedAt, defaultValue: 'Restore the version from {{date}}?' })
            : t('notes.restoreConfirmNoDate', { defaultValue: 'Restore the previous version?' }),
          () => {
            onRestorePreviousNote?.(i)
              .then(landed => notify('info', landed
                ? t('notes.restoreNotice', { defaultValue: 'Restored. You can undo this once more.' })
                : unavailable(t)))
              .catch(() => notify('info', unavailable(t)))
          },
          { title: restoreConfirmTitle, children: renderPreview(preview.previous_body ?? '') },
        )
      })
      .catch(() => notify('info', unavailable(t)))
      .finally(() => setRestoringIdx(null))
  }

  return { restoringIdx, requestRestorePrevious }
}
