/**
 * useMatchApproval — approve/reject workflow for one match (MATCH-APPROVAL-1).
 * approval_status lives on the list row; the rejection REASON is detail-only, so a
 * rejected match lazily fetches GET /matches/{id} once to show it (data minimization,
 * §8 — never fetched for a pending/approved match). Both actions are optimistic with
 * revert-on-error; a 409 means someone else already reviewed it in the meantime.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notify } from '@/lib/notify'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

export function useMatchApproval(match: MatchRow | null, onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void) {
  const { t } = useTranslation('matches')
  const [reason, setReason] = useState<string>(match?.approval_rejected_reason || '')
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  // Reset local state when the drawer switches to a different match, and lazily
  // fetch the rejection reason for a rejected match that doesn't carry one yet.
  useEffect(() => {
    setReason(match?.approval_rejected_reason || '')
    setRejectOpen(false)
    if (!match?.id || match.approval_status !== 'rejected' || match.approval_rejected_reason) return
    const ctrl = new AbortController()
    api.get(`/matches/${match.id}`, { signal: ctrl.signal })
      .then(r => {
        const d = (unwrap(r)) as { approval_rejected_reason?: string }
        if (d?.approval_rejected_reason) setReason(d.approval_rejected_reason)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [match?.id, match?.approval_status, match?.approval_rejected_reason])

  // Toast + revert shared by both actions on failure — a 409 means already reviewed.
  const handleError = useCallback((err: unknown, id: Id, prevStatus?: string) => {
    onUpdate?.(id, { approval_status: prevStatus })
    const status = (err as { response?: { status?: number } })?.response?.status
    notify(status === 409 ? 'info' : 'error', status === 409 ? t('approval.alreadyReviewed') : t('approval.error'))
  }, [onUpdate, t])

  // Approve: optimistic → POST → revert + toast on failure/409.
  const approve = useCallback(async () => {
    if (!match?.id || busy) return
    const prev = match.approval_status
    setBusy(true)
    onUpdate?.(match.id, { approval_status: 'approved' })
    try {
      await api.post(`/matches/${match.id}/approve`)
    } catch (err) {
      handleError(err, match.id, prev)
    } finally { setBusy(false) }
  }, [match, busy, onUpdate, handleError])

  // Reject: requires a non-empty reason (textarea); same optimistic/revert pattern.
  const reject = useCallback(async (reasonText: string) => {
    if (!match?.id || busy || !reasonText.trim()) return
    const prev = match.approval_status
    const trimmed = reasonText.trim()
    setBusy(true)
    onUpdate?.(match.id, { approval_status: 'rejected', approval_rejected_reason: trimmed })
    setReason(trimmed)
    try {
      await api.post(`/matches/${match.id}/reject`, { reason: trimmed })
      setRejectOpen(false)
    } catch (err) {
      setReason(match.approval_rejected_reason || '')
      handleError(err, match.id, prev)
    } finally { setBusy(false) }
  }, [match, busy, onUpdate, handleError])

  return { reason, busy, rejectOpen, setRejectOpen, approve, reject }
}
