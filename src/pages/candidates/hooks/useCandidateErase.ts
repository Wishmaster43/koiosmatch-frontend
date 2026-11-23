/**
 * useCandidateErase (CANDIDATE-ERASE-FE-1, Danny 23-11 Q6): the password-confirmed anonymise of ONE
 * candidate (POST /candidates/{id}/erase, mode anonymize; BE DataErasureController::eraseCandidate) and
 * the ERASURE-OPEN-MATCH-1 refusal: a candidate with an OPEN match answers 409 candidate_has_open_match
 * until the request carries close_open_matches: true, which ends every open match through the match
 * termination seam (stop reason erasure_request, a stored system note) and anonymises in the same
 * transaction. The request body is typed from the generated spec; the 2xx shape is hand-written
 * (the spec carries no success schema for this route).
 */
import { useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import type { Id } from '@/types/common'
import type { operations } from '@/types/api-generated'

type EraseBody = operations['postCandidatesCandidateErase']['requestBody']['content']['application/json']
// close_open_matches joins the generated spec with the BE landing (gen:types); typed by hand until then.
type EraseRequest = EraseBody & { close_open_matches?: true }
// Hand-written: the spec carries no 2xx schema for this route.
interface EraseResponse { message?: string }

/** The stable 409 code of the open-match refusal (BE CandidateHasOpenMatchException::CODE). */
export const CANDIDATE_HAS_OPEN_MATCH = 'candidate_has_open_match'

// Anonymise one candidate, re-confirmed with the signed-in user's own password. The three statuses the
// dialog renders itself (403 wrong password, 409 open match, 422 validation) stay out of the dev toast.
export async function eraseCandidate(id: Id, password: string, closeOpenMatches = false): Promise<EraseResponse> {
  const body: EraseRequest = closeOpenMatches
    ? { password, mode: 'anonymize', close_open_matches: true }
    : { password, mode: 'anonymize' }
  const res = await api.post(`/candidates/${id}/erase`, body, { quietStatuses: [403, 409, 422] })
  return unwrap<EraseResponse>(res)
}

type ConflictT = (key: string, opts?: { count: number }) => string

// The translated open-match sentence for a 409 candidate_has_open_match (with the open count when the
// body carries it: staff only, RefusalAudience), or null for every other error so the dialog maps it as usual.
export function openMatchConflictMessage(err: unknown, t: ConflictT): string | null {
  const resp = (err as { response?: { status?: number; data?: { code?: string; context?: { open_matches?: unknown } } } })?.response
  if (resp?.status !== 409 || resp.data?.code !== CANDIDATE_HAS_OPEN_MATCH) return null
  const n = resp.data?.context?.open_matches
  return typeof n === 'number' && n > 0 ? t('erase.openMatch', { count: n }) : t('erase.openMatchUnknown')
}

// Owns the dialog open flag and the confirm POST; success toasts the FE copy (the user's UI language,
// never the bureau-language server sentence) and hands the id back so the caller refreshes the record.
export function useCandidateErase(id: Id | null | undefined, doneMessage: string, onErased: (id: Id) => void | Promise<void>) {
  const [erasing, setErasing] = useState(false)

  // Throws on failure so the shared dialog renders the mapped message (or the conflict step) and stays open.
  const confirm = async (password: string, opts?: { resolveConflict: boolean }) => {
    if (id == null) return
    await eraseCandidate(id, password, opts?.resolveConflict === true)
    notifySuccess(doneMessage)
    setErasing(false)
    await onErased(id)
  }

  return { erasing, open: () => setErasing(true), cancel: () => setErasing(false), confirm }
}
