/**
 * useDetachApplication — the "detach an application from its vacancy/candidate"
 * mutation shared by the candidate drawer's WorkTab and the vacancy drawer's
 * ApplicantsTab. Punt 7 — measured live 08-08: DELETE /applications/{id}
 * REQUIRES a `reason` body (422 "The reason field is required." without it,
 * 204 with it), stored by the backend as an application note. Non-optimistic
 * on purpose: a 422/403 must never look like it succeeded (§13).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { Id } from '@/types/common'

export function useDetachApplication({ getId, doneLabel, onDone }: {
  getId: () => Id | null | undefined
  doneLabel: string
  onDone: () => void | Promise<void>
}) {
  const [detaching, setDetaching] = useState(false)

  const detachApplication = async (reason: string, failLabel: string) => {
    const id = getId()
    if (id == null) return
    setDetaching(true)
    try {
      await api.delete(`/applications/${id}`, { data: { reason } })
      notifySuccess(doneLabel)
      await onDone()
    } catch (err) {
      notifyError(extractApiError(err, failLabel))
    } finally { setDetaching(false) }
  }

  return { detaching, detachApplication }
}
