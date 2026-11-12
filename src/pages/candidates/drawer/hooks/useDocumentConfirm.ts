/**
 * useDocumentConfirm — F-004: staff accepts an applicant's unconfirmed file via
 * POST /candidates/{id}/documents/{docId}/confirm. Rejecting reuses the row's
 * existing delete path, so no reject route lives here.
 */
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { isPersisted, formatDocSize } from '../documentHelpers'
import type { DocItem } from '../documentHelpers'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export function useDocumentConfirm(c: Candidate, setDocs: Dispatch<SetStateAction<DocItem[]>>) {
  const { t } = useTranslation('candidates')
  const [confirmingId, setConfirmingId] = useState<Id | null>(null)
  // Mount guard, armed in the effect setup (StrictMode safe): no state after unmount.
  const alive = useRef(true)
  // In-flight flag: closure-independent re-entry guard (state lags until re-render).
  const inFlight = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // Accept one file: server returns the fresh row, which replaces the local one.
  const confirmDoc = async (id: Id): Promise<void> => {
    if (!isPersisted(id) || inFlight.current) return
    inFlight.current = true
    setConfirmingId(id)
    try {
      const res = await api.post(`/candidates/${c.id}/documents/${id}/confirm`)
      // The resource carries size in bytes; format it, or keep the local string when the response omits it.
      const row = unwrap<DocItem>(res)
      if (alive.current && row) setDocs(prev => prev.map(x => x.id === id ? { ...x, ...row, size: row.size != null ? formatDocSize(row.size) : x.size } : x))
    } catch (err) {
      notifyError(extractApiError(err, t('common:actionFailed')))
    } finally {
      inFlight.current = false
      if (alive.current) setConfirmingId(null)
    }
  }

  return { confirmDoc, confirmingId }
}
