/**
 * useContractSend — HF-CONTRACT-SEND-1: the manual HelloFlex contract send from a
 * match. POSTs `/matches/{id}/contract` with an EMPTY body (the server builds the
 * contract from the stored match) and a fresh per-click Idempotency-Key
 * (the server claims the send right before the HelloFlex call). The 200
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

// Hand-written: the spec carries no 2xx schema. BE 80d2c127f (HF-IDEMPOTENT-1): `outcome` 'adopted' means
// NOTHING was sent, an existing HelloFlex contract was taken over; contract_status stays a wide string
// (sent, active, ended, signed or rejected).
export interface ContractSendResult { guid?: string | null; contract_status?: string | null; outcome?: 'sent' | 'adopted' }

export type ContractSendOutcome =
  | { ok: true; data: ContractSendResult }
  | { ok: false; message: string | null; fieldErrors: Record<string, string> }

export function useContractSend(matchId: Id | undefined) {
  const { t } = useTranslation(['matches', 'common'])
  const [sending, setSending] = useState(false)

  // Posts the contract; never throws, so the modal renders field errors or one sentence.
  const send = useCallback(async (): Promise<ContractSendOutcome> => {
    setSending(true)
    try {
      const res = await api.post(`/matches/${matchId}/contract`, {}, withIdempotencyKey())
      return { ok: true, data: res?.data?.data ?? res?.data ?? {} }
    } catch (err) {
      const bag = extractFormErrorsWithMessages(err, {})
      if (bag) return { ok: false, message: null, fieldErrors: bag.messages }
      // The connector module gate answers 403 module_not_enabled (AUTHZ-REFUSAL-CODE-2): the HelloFlex
      // module is off for this bureau, so say that specifically instead of the generic module sentence.
      const res = (err as { response?: { status?: number; data?: { code?: string } } }).response
      if (res?.status === 403 && res.data?.code === 'module_not_enabled') return { ok: false, message: t('errors.helloflexModuleOff', { ns: 'common' }), fieldErrors: {} }
      // A 5xx without a code carries the server's own (Dutch) sentence: show ours instead (§5).
      const rawServerText = (res?.status ?? 0) >= 500 && !res?.data?.code
      const fallback = t('drawer.contractSend.error')
      return { ok: false, message: rawServerText ? fallback : apiErrorMessage(err, t as never, fallback), fieldErrors: {} }
    } finally {
      setSending(false)
    }
  }, [matchId, t])

  return { send, sending }
}
