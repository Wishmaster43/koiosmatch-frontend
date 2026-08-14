/**
 * useTrashFlow (TRASH-OVERAL-2) — page-level wiring around the shared
 * useDeletionLifecycle hook for one entity list: which row the shared
 * DeletionPreviewModal is open for, the busy/blocked state of a mark attempt,
 * and the unmark ("back to archive") action from the trash view. One hook so
 * every trash-enabled entity page wires the exact same flow instead of a
 * hand-rolled copy per page.
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { eraseAroundDate, useDeletionLifecycle } from '@/hooks/useDeletionLifecycle'

// The row the preview modal is currently open for (id + human label for the intro).
export interface TrashTarget { id: string; label: string }

interface Args {
  /** API path segment, e.g. 'matches' | 'outreach-campaigns' | 'workflows'. */
  entityPath: string
  /** List refresh after a successful mark (the row moved into the trash). */
  onMarked?: (id: string) => void
  /** List refresh after a successful unmark (the row is back to plain archived). */
  onUnmarked?: (id: string) => void
}

export function useTrashFlow({ entityPath, onMarked, onUnmarked }: Args) {
  const { t } = useTranslation('common')
  const [target, setTarget] = useState<TrashTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  // Keyed on the open target: opening fetches a fresh deletion preview per row.
  const deletion = useDeletionLifecycle(entityPath, target?.id ?? null)

  // Open the preview modal for one row (blockers/lifecycle load via the hook).
  const openFor = useCallback((id: string | number, label: string) => {
    setBlocked(false)
    setTarget({ id: String(id), label })
  }, [])

  const close = useCallback(() => { setTarget(null); setBlocked(false) }, [])

  // Confirm: POST mark-deletion. A 409 in_use keeps the modal open (it renders the
  // refreshed blocker list + honest notice); success closes it and refreshes the list.
  const confirmMark = useCallback(async (transferToOwnerId?: string | null) => {
    if (!target) return
    setBusy(true)
    try {
      const result = await deletion.mark(transferToOwnerId)
      if (result.blocked) { setBlocked(true); return }
      const id = target.id
      setTarget(null)
      notifySuccess(t('trash.marked'))
      onMarked?.(id)
    } catch {
      notifyError(t('actionFailed'))
    } finally {
      setBusy(false)
    }
  }, [deletion, target, onMarked, t])

  // Trash view → back to plain archived (restore-to-active stays the /restore route).
  const unmark = useCallback(async (id: string | number) => {
    try {
      await api.post(`/${entityPath}/${id}/unmark-deletion`)
      notifySuccess(t('trash.unmarked'))
      onUnmarked?.(String(id))
    } catch {
      notifyError(t('actionFailed'))
    }
  }, [entityPath, onUnmarked, t])

  return {
    target, openFor, close, confirmMark, unmark, busy, blocked,
    preview: deletion.preview, loading: deletion.loading, error: deletion.error,
    graceDays: deletion.graceDays,
  }
}

// Compose the trash-state note ("In trash since 12-08-2026 · will be permanently
// deleted around 11-09-2026") from the row's pending_erase_at + the tenant grace
// window; wording degrades honestly when either half is unknown (never a made-up date).
export function buildTrashNote(
  t: (key: string, opts?: Record<string, unknown>) => string,
  formatDate: (d?: string | Date | null) => string,
  pendingEraseAt: string | null | undefined,
  graceDays: number | null,
): string {
  const around = eraseAroundDate(pendingEraseAt, graceDays)
  return [
    pendingEraseAt ? t('common:trash.pendingSince', { date: formatDate(pendingEraseAt) }) : null,
    around ? t('common:trash.eraseAround', { date: formatDate(around) }) : t('common:trash.eraseAutomatic'),
  ].filter(Boolean).join(' · ')
}
