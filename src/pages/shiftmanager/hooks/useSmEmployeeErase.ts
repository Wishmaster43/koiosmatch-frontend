/**
 * useSmEmployeeErase — ONIX H-003: dialog state + the password-confirmed erase
 * POST for ONE Shiftmanager employee (POST /sm_candidates/{id}/erase {password}).
 * The request body is typed from the generated spec; the 2xx shape is hand-written
 * (the spec carries no success schema for this route yet).
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import type { operations } from '@/types/api-generated'

type EraseBody = operations['postSmCandidatesCandidateErase']['requestBody']['content']['application/json']
// Hand-written: no 2xx schema in the generated spec for this route.
interface EraseResponse { message?: string; sm_candidate_id?: string }

// Erase one employee's personal data, re-confirmed with the signed-in user's own password.
export async function eraseSmEmployee(id: string | number, password: string): Promise<EraseResponse> {
  const body: EraseBody = { password }
  const res = await api.post(`/sm_candidates/${id}/erase`, body)
  return unwrap<EraseResponse>(res)
}

// Owns the dialog open flag and the confirm POST; success toasts, refreshes the list and closes the drawer.
export function useSmEmployeeErase(id: string | number | undefined, close: () => void, fallbackMessage: string) {
  const queryClient = useQueryClient()
  const [erasing, setErasing] = useState(false)

  // Throws on failure so the shared dialog renders the mapped message and stays open.
  const confirm = async (password: string) => {
    if (id == null) return
    const res = await eraseSmEmployee(id, password)
    notifySuccess(res?.message || fallbackMessage)
    await queryClient.invalidateQueries({ queryKey: ['sm_candidates'] })
    setErasing(false)
    close()
  }

  return { erasing, open: () => setErasing(true), cancel: () => setErasing(false), confirm }
}
