/**
 * MatchApprovalActions — the interactive half of the approval workflow (MATCH-
 * APPROVAL-1): a rejected match's reason as a muted line, and — when pending AND
 * the user may update matches — Goedkeuren/Afwijzen buttons. Reject opens a small
 * required-reason prompt before posting. Purely presentational: MatchDrawer wires
 * the data (useMatchApproval) and passes it in via props.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import Button from '@/components/ui/Button'

interface MatchApprovalActionsProps {
  status?: string
  reason?: string
  // Coupling-style gate: the caller checks hasPermission('matches.update') (§7 — UI-only, backend re-checks).
  canUpdate: boolean
  busy: boolean
  rejectOpen: boolean
  onOpenReject: () => void
  onCancelReject: () => void
  onApprove: () => void
  onReject: (reason: string) => void
}

export default function MatchApprovalActions({
  status, reason, canUpdate, busy, rejectOpen, onOpenReject, onCancelReject, onApprove, onReject,
}: MatchApprovalActionsProps) {
  const { t } = useTranslation('matches')
  const [reasonText, setReasonText] = useState('')
  if (!status) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {status === 'pending' && canUpdate && !rejectOpen && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="success" size="sm" onClick={onApprove} disabled={busy} aria-label={t('approval.approve')}>
            <Check size={11} />{t('approval.approve')}
          </Button>
          <Button variant="dangerSoft" size="sm" onClick={onOpenReject} disabled={busy} aria-label={t('approval.reject')}>
            <X size={11} />{t('approval.reject')}
          </Button>
        </div>
      )}

      {/* Rejected — the reason as a muted line (never a wall of pickers). */}
      {status === 'rejected' && reason && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reason}</div>
      )}

      {/* Reject reason prompt — required, calm inline form. A plain <textarea> is the
          documented exception to the rich-text rule (§3A): this is a short structured
          "why", not user-facing prose, and the backend stores it as a plain string —
          exactly like DetachReasonModal and the candidate status-reason prompts. */}
      {rejectOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} rows={2}
            placeholder={t('approval.reasonPlaceholder')} aria-label={t('approval.reasonPlaceholder')}
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={() => { onCancelReject(); setReasonText('') }}>
              {t('common:cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={() => onReject(reasonText)} disabled={!reasonText.trim() || busy}>
              {t('approval.confirmReject')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
