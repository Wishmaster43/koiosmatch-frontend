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

const actionBtn = (color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 11, fontWeight: 600,
  borderRadius: 7, cursor: 'pointer', border: `1px solid ${color}`, background: 'transparent', color,
})

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
          <button onClick={onApprove} disabled={busy} aria-label={t('approval.approve')}
            style={{ ...actionBtn('var(--color-success)'), opacity: busy ? 0.6 : 1 }}>
            <Check size={11} />{t('approval.approve')}
          </button>
          <button onClick={onOpenReject} disabled={busy} aria-label={t('approval.reject')}
            style={{ ...actionBtn('var(--color-danger)'), opacity: busy ? 0.6 : 1 }}>
            <X size={11} />{t('approval.reject')}
          </button>
        </div>
      )}

      {/* Rejected — the reason as a muted line (never a wall of pickers). */}
      {status === 'rejected' && reason && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reason}</div>
      )}

      {/* Reject reason prompt — required textarea, calm inline form. */}
      {rejectOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} rows={2}
            placeholder={t('approval.reasonPlaceholder')} aria-label={t('approval.reasonPlaceholder')}
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => { onCancelReject(); setReasonText('') }}
              style={{ height: 26, padding: '0 10px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
              {t('common:cancel')}
            </button>
            <button onClick={() => onReject(reasonText)} disabled={!reasonText.trim() || busy}
              style={{ height: 26, padding: '0 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6,
                background: 'var(--color-danger)', color: '#fff', cursor: (reasonText.trim() && !busy) ? 'pointer' : 'default', opacity: (reasonText.trim() && !busy) ? 1 : 0.4 }}>
              {t('approval.confirmReject')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
