/**
 * popoutNoteWrite — the shared tail of a popout note write (POPOUT-PARITEIT-1):
 * persist, reload the list on success, revert the optimistic state + surface the
 * server's own reason on failure, and resolve the honest "landed" flag the
 * PopoutSaveFooter contract requires (§3: never a silently-stuck fake note).
 */
import type { TFunction } from 'i18next'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'

// Resolves true only when the write actually landed; false after a revert.
export function landedWrite(request: Promise<unknown>, reload: () => void, revert: () => void, t: TFunction): Promise<boolean> {
  return request
    .then(() => { reload(); return true })
    .catch(err => {
      revert()
      notifyError(extractApiError(err, t('common:actionFailed')))
      return false
    })
}
