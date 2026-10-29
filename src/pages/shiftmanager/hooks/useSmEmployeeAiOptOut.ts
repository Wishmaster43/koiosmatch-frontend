/**
 * useSmEmployeeAiOptOut — ONIX H-003: the ai_enabled switch of ONE Shiftmanager
 * employee, the only writer of that flag (PATCH /sm_candidates/{id} {ai_enabled}).
 * The body is typed from the generated spec; the response is the SmCandidateResource.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { apiErrorMessage } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import type { operations } from '@/types/api-generated'

type PatchBody = operations['patchSmCandidatesCandidate']['requestBody'] extends infer R
  ? R extends { content: { 'application/json': infer B } } ? B : never : never
// Hand-written: the spec carries no 2xx schema for this route.
interface PatchResponse { ai_enabled?: boolean }

// Optimistic switch: shows the new value at once, reconciles from the response, rolls back with a toast on error.
export function useSmEmployeeAiOptOut(id: string | number | undefined, serverValue: boolean | undefined, failMessage: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  // Local override per employee id, so a switch on one row never leaks onto the next.
  const [override, setOverride] = useState<{ id: string | number; value: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const current = override && override.id === id ? override.value : serverValue

  // Send the new flag; keep the optimistic value unless the request fails.
  const setEnabled = async (next: boolean) => {
    if (id == null || saving) return
    const previous = current
    setOverride({ id, value: next })
    setSaving(true)
    try {
      const body: PatchBody = { ai_enabled: next }
      const res = await api.patch(`/sm_candidates/${id}`, body)
      const saved = unwrap<PatchResponse>(res)
      if (typeof saved?.ai_enabled === 'boolean') setOverride({ id, value: saved.ai_enabled })
      await queryClient.invalidateQueries({ queryKey: ['sm_candidates'] })
    } catch (err) {
      setOverride(previous === undefined ? null : { id, value: previous })
      notifyError(apiErrorMessage(err, t, failMessage))
    } finally {
      setSaving(false)
    }
  }

  return { enabled: current, saving, setEnabled }
}
