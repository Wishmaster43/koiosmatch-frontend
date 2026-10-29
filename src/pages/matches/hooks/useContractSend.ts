/**
 * useContractSend — HF-CONTRACT-SEND-1: the manual HelloFlex contract send from a
 * match. POSTs `/matches/{id}/contract` with a fresh per-click Idempotency-Key
 * (the server claims the send right before the HelloFlex call). The body is
 * financial data (§7/§8): it is never logged, cached or persisted here; the 200
 * answer carries only the returned status. Failures resolve to a result object:
 * a 422 yields per-field messages, anything else a translated sentence (the
 * coded 409 refusals map through ERROR_CODE_KEYS, never the server's raw text).
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { withIdempotencyKey } from '@/lib/idempotency'
import { apiErrorMessage } from '@/lib/extractApiError'
import { extractFormErrorsWithMessages } from '@/lib/extractFormErrors'
import type { Id } from '@/types/common'
import type { operations } from '@/types/api-generated'

// Request body typed from the generated spec where it carries the route.
export type ContractSendBody = operations['postMatchesMatchContract']['requestBody']['content']['application/json']

// Hand-written: the spec carries no 2xx schema; the server answers status (+ GUID, never shown).
export interface ContractSendResult { guid?: string | null; contract_status?: string | null }

export type ContractSendOutcome =
  | { ok: true; data: ContractSendResult }
  | { ok: false; message: string | null; fieldErrors: Record<string, string> }

export function useContractSend(matchId: Id | undefined) {
  const { t } = useTranslation(['matches', 'common'])
  const [sending, setSending] = useState(false)

  // Posts the contract; never throws, so the modal renders field errors or one sentence.
  const send = useCallback(async (body: ContractSendBody): Promise<ContractSendOutcome> => {
    setSending(true)
    try {
      const res = await api.post(`/matches/${matchId}/contract`, body, withIdempotencyKey())
      return { ok: true, data: res?.data?.data ?? res?.data ?? {} }
    } catch (err) {
      const bag = extractFormErrorsWithMessages(err, {})
      if (bag) return { ok: false, message: null, fieldErrors: bag.messages }
      // A 5xx without a code carries the server's own (Dutch) sentence: show ours instead (§5).
      const e = err as { response?: { status?: number; data?: { code?: string } } }
      const rawServerText = (e.response?.status ?? 0) >= 500 && !e.response?.data?.code
      const fallback = t('drawer.contractSend.error')
      return { ok: false, message: rawServerText ? fallback : apiErrorMessage(err, t as never, fallback), fieldErrors: {} }
    } finally {
      setSending(false)
    }
  }, [matchId, t])

  return { send, sending }
}
