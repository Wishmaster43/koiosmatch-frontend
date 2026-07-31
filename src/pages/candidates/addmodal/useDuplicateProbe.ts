/**
 * useRestoreDuplicate — the one real action a BLOCKED create can still offer: an
 * archived duplicate can be brought back (DUP-ARCHIVED-1 is exactly why the create
 * 409 payload carries `archived`).
 *
 * A live "warn while you type" probe lived here and was removed the same day it was
 * written. GET /candidates/check-duplicate takes the email and mobile as QUERY
 * PARAMETERS, so probing on every edit would have written candidates' contact details
 * into web-server access logs, proxies and browser history — §7 forbids PII in a query
 * string, and a debounce does not change where the data lands. A POST variant is
 * requested from the backend; until then the create 409 is the gate, as it always was.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Id } from '@/types/common'

// What the UI is allowed to know about a duplicate: WHO and WHICH STATE. The 409
// payload also carries `type` (deployability) — deliberately not read: special-category
// data, and the name + state is all the notice needs (§8).
export interface DuplicateMatch {
  id: Id
  name?: string | null
  archived?: boolean
}

// Restore an archived duplicate via the per-id route (§10: een record = de
// per-id-route). The list/stats caches have no row for it yet, so invalidate them;
// the caller opens the record afterwards.
export function useRestoreDuplicate() {
  const { t } = useTranslation('candidates')
  const [restoring, setRestoring] = useState(false)

  const restore = async (id: Id): Promise<boolean> => {
    setRestoring(true)
    try {
      await api.post(`/candidates/${id}/restore`)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      notifySuccess(t('duplicate.restored'))
      return true
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('duplicate.restoreForbidden') : t('duplicate.restoreFailed'))
      return false
    } finally {
      setRestoring(false)
    }
  }

  return { restore, restoring }
}
