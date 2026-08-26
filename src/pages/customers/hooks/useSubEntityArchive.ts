/**
 * useSubEntityArchive — the archive/restore mutation state shared by
 * Location/Department/ContactDetail (ARCHIVE-SUBENTITY-1). One hook instead of
 * three near-identical archiveNow/doRestore blocks (§11 — a new shared helper
 * lands with adoption on the existing copy-sites, not beside them). Messages
 * arrive pre-translated (mirrors ArchivedBanner's own `message`/`restoreLabel`
 * props) so this hook carries no i18n namespace of its own.
 */
import { useState } from 'react'
import { notifyError } from '@/lib/notify'
import type { Id } from '@/types/common'

interface Options<T> {
  customerId: Id | undefined
  id: Id
  archiveFn: (customerId: Id, id: Id) => Promise<void>
  restoreFn: (customerId: Id, id: Id) => Promise<T>
  /** Called after a successful archive OR restore — both entity details close the
   * drill-down (the record either left the live view or the archived one). */
  onDone: () => void
  archiveFailedMessage: string
  restoreFailedMessage: string
}

// The one shared archive/restore mutation for location/department/contact detail
// screens — see the module doc comment above for why it replaced three near-identical copies.
export function useSubEntityArchive<T>({
  customerId, id, archiveFn, restoreFn, onDone, archiveFailedMessage, restoreFailedMessage,
}: Options<T>) {
  const [archiving, setArchiving] = useState(false)

  // Archiving carries NONE of the hard-delete in-use guard — it always succeeds,
  // which is exactly why it is the offered way out of the 409-race counts dialog.
  const archiveNow = async () => {
    if (!customerId) return
    setArchiving(true)
    try { await archiveFn(customerId, id); onDone() }
    catch { notifyError(archiveFailedMessage) }
    finally { setArchiving(false) }
  }

  // Restore an archived record and close the drill-down on success, same as archiveNow above.
  const doRestore = async () => {
    if (!customerId) return
    try { await restoreFn(customerId, id); onDone() }
    catch { notifyError(restoreFailedMessage) }
  }

  return { archiving, archiveNow, doRestore }
}
