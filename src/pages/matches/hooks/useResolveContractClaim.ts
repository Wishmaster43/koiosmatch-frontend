/**
 * useResolveContractClaim — CLAIM-RESOLVE-1: resolves a match's HelloFlex
 * send-claim stuck on `contract_status === 'sending'` immediately, instead of
 * waiting for the backend's own 15/60-minute exits. POSTs
 * `/matches/{id}/contract/resolve` with `{ reason }` and a fresh per-click
 * Idempotency-Key (§0 IDEMP-KEY-BODYLESS-1 sibling — this call DOES carry a
 * body, but the key still guards a double-click from releasing the claim
 * twice). On success returns the 200 body (`{ contract_status: 'failed',
 * resolved: true }`) so the caller can patch the row locally; on a 409 the
 * caller reads the error's `code` (never swallowed here).
 */
import { useState, useCallback } from 'react'
import api from '@/lib/api'
import { withIdempotencyKey } from '@/lib/idempotency'
import type { Id } from '@/types/common'
import type { operations } from '@/types/api-generated'

// Request body typed from the generated spec, so a backend field rename
// surfaces as a compile error here instead of a silent runtime 422.
type ResolveBody = operations['postMatchesMatchContractResolve']['requestBody']['content']['application/json']
// Hand-written: the generated spec carries no 2xx schema for this route yet.
interface ResolveResult { contract_status: string; resolved: boolean }

export function useResolveContractClaim(matchId: Id | undefined) {
  const [resolving, setResolving] = useState(false)

  // Posts the resolve route for this match; throws on failure, the caller maps the error.
  const resolve = useCallback(async (reason: string): Promise<ResolveResult> => {
    setResolving(true)
    try {
      const body: ResolveBody = { reason }
      const res = await api.post(`/matches/${matchId}/contract/resolve`, body, withIdempotencyKey())
      return res?.data?.data ?? res?.data
    } finally {
      setResolving(false)
    }
  }, [matchId])

  return { resolve, resolving }
}
