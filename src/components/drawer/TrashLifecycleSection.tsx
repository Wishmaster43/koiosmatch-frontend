/**
 * TrashLifecycleSection (TRASH-OVERAL-2) — the ONE drawer surface for the two-step
 * trash lifecycle, shared verbatim by customers/vacancies/opportunities/tasks.
 * While the record is not in the trash it renders the "Definitief verwijderen"
 * action (permission-gated) that opens the shared DeletionPreviewModal wired via
 * useDeletionLifecycle; once lifecycle is pending_erase it renders the danger
 * banner with the projected erase date + "Terugzetten naar archief" instead.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Undo2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import DeletionPreviewModal from '@/components/ui/DeletionPreviewModal'
import PendingEraseBanner from '@/components/drawer/PendingEraseBanner'
import { useDeletionLifecycle, eraseAroundDate } from '@/hooks/useDeletionLifecycle'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

// Page-supplied wiring: permissions come from useAuth().hasPermission at the page
// (mark = '<entity>.delete', unmark = '<entity>.update'), users feed the transfer
// picker, and the callbacks reconcile the page's local list/drawer state.
export interface TrashSectionConfig {
  canMark: boolean
  canUnmark: boolean
  users: Array<{ value: string; label: string }>
  onMarked: (id: Id) => void
  onUnmarked: (id: Id) => void
}

interface TrashLifecycleSectionProps extends TrashSectionConfig {
  /** API path segment: 'customers' | 'vacancies' | 'opportunities' | 'tasks'. */
  entityPath: string
  id: Id | undefined
  /** Human name of the record, woven into the modal's intro sentence. */
  entityLabel: string
  lifecycle?: string
  pendingEraseAt?: string | null
}


export default function TrashLifecycleSection({
  entityPath, id, entityLabel, lifecycle, pendingEraseAt = null,
  canMark, canUnmark, users, onMarked, onUnmarked,
}: TrashLifecycleSectionProps) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [unmarkBusy, setUnmarkBusy] = useState(false)
  // The hook only gets the id while the modal is open, so the preview GET never
  // fires on a plain drawer open (§8 data minimization); the grace-days lookup
  // inside the hook is a session-shared cache and runs either way.
  const { preview, loading, error, graceDays, mark } =
    useDeletionLifecycle(entityPath, modalOpen && id != null ? String(id) : null)

  // Modal confirm → POST mark-deletion; a 409 keeps the modal open with the fresh
  // blocker list (the hook already reflected it into the preview).
  const confirmMark = async (transferToOwnerId?: string | null) => {
    if (id == null) return
    setBusy(true)
    try {
      const res = await mark(transferToOwnerId)
      if (res.blocked) { setBlocked(true); return }
      setModalOpen(false)
      notifySuccess(t('trash.marked'))
      onMarked(id)
    } catch {
      notifyError(t('actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  // Banner unmark → POST unmark-deletion directly (NOT the hook's unmark: the hook
  // is only armed with an id while the modal is open — see the comment above).
  const doUnmark = () => {
    if (id == null || unmarkBusy) return
    setUnmarkBusy(true)
    api.post(`/${entityPath}/${id}/unmark-deletion`)
      .then(() => { notifySuccess(t('trash.unmarked')); onUnmarked(id) })
      .catch(() => notifyError(t('actionFailed')))
      .finally(() => setUnmarkBusy(false))
  }

  // In the trash: danger banner (since-when + projected erase date, DD-MM-YYYY via
  // the house formatter) + the permission-gated way back to the archive.
  if (lifecycle === 'pending_erase') {
    const eraseAt = eraseAroundDate(pendingEraseAt, graceDays)
    const eraseLine = eraseAt ? t('trash.eraseAround', { date: formatDate(eraseAt) }) : t('trash.eraseAutomatic')
    const message = pendingEraseAt ? `${t('trash.pendingSince', { date: formatDate(pendingEraseAt) })} · ${eraseLine}` : eraseLine
    return (
      <PendingEraseBanner id={id} message={message}
        onUnmark={canUnmark ? doUnmark : undefined} unmarkLabel={t('trash.unmarkAction')}
        unmarkBusy={unmarkBusy} unmarkVariant="button" unmarkIcon={Undo2} unmarkColor="var(--color-archive)" />
    )
  }

  // TRASH-ARCHIEF-EERST-1 (Danny 19-08, on this exact button): hard delete exists
  // ONLY from the ARCHIVE. A live record is soft-deleted (archived) first — so an
  // active drawer renders no destructive affordance at all, in all four entities
  // that share this section (the candidate blueprint already worked this way: its
  // hard delete lives inside the ArchivedBanner). Also still HIDDEN (never
  // disabled) without the '<entity>.delete' permission — no fake affordances.
  if (!canMark || lifecycle !== 'archived') return null
  return (
    <>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="dangerSoft" size="sm" onClick={() => { setBlocked(false); setModalOpen(true) }}>
          <Trash2 size={12} aria-hidden="true" /> {t('trash.markAction')}
        </Button>
      </div>
      <DeletionPreviewModal open={modalOpen} onClose={() => setModalOpen(false)} entityLabel={entityLabel}
        preview={preview} loading={loading} error={error} users={users}
        onConfirm={confirmMark} busy={busy} blocked={blocked} graceDays={graceDays} />
    </>
  )
}
