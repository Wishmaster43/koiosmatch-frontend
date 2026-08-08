/**
 * DetachApplicationModal — the confirm step for "ontkoppel deze sollicitatie"
 * from the candidate drawer (Danny punt 7, 08-08).
 *
 * WHY NOT the shared ConfirmDialog: measured live against the API on 08-08 —
 * `DELETE /applications/{id}` with no body answers **422 {"message":"The reason
 * field is required."}**, and with `{"reason":"…"}` answers **204**
 * (ApplicationController::destroy validates `reason: required|string|max:1000`
 * and stores it as an application note). A yes/no dialog cannot carry that
 * reason, so it would ship a guaranteed-422 button — the exact "bulk-ontkoppelen
 * was volledig dood terwijl de unit-test groen was" lesson (§13). This prompt is
 * therefore a reason-collecting confirm, in the same shape the candidate drawer
 * already uses for its own status-reason prompt (FloatingPanel + plain textarea +
 * cancel/confirm), with the danger tint on the confirm button.
 *
 * The reason is a plain string (BE validates `string|max:1000`, not rich
 * content) — the same documented deviation from the rich-text rule as
 * StatusReasonModal: it is never rendered as HTML, only stored as note text.
 *
 * KNOWN DUPLICATION (reported, not hidden): `pages/applications/drawer/
 * DetachReasonModal.tsx` is the same prompt for the applications page. Promoting
 * it to `components/ui` is the right fix, but that file belongs to another lane's
 * page today (§2 forbids importing another entity page's internals), so this one
 * stays local until the two can be merged in one deliberate move.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Unlink } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { Z } from '@/lib/zIndexScale'
import { BTN_H } from '@/config/buttonMetrics'

// Mirrors the backend limit (ApplicationController::destroy — string|max:1000).
const REASON_MAX = 1000

export default function DetachApplicationModal({ label, onCancel, onConfirm, submitting }: {
  // The row's own vacancy label — names WHAT is being detached in the message.
  label: string
  onCancel: () => void
  onConfirm: (reason: string) => void
  submitting?: boolean
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const disabled = !trimmed || Boolean(submitting)

  return (
    // Same shared chrome as the sibling candidate prompts — draggable, focus-trapped,
    // above the drawer via Z.confirm.
    <FloatingPanel open onClose={onCancel} ariaLabel={t('work.detachTitle')}
      persistKey="candidate-detach-application" width={420} maxWidth="92vw" zIndex={Z.confirm}
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} aria-hidden="true"><Unlink size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('work.detachTitle')}</span>
        </span>
      }>
        {/* Honest explanation: detaching is a reversible soft-delete, and the reason lands in the timeline. */}
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 12 }}>
          {t('work.detachMessage', { name: label })}
        </div>
        <label htmlFor="detach-application-reason" style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
          {t('work.detachReasonLabel')}
        </label>
        <textarea id="detach-application-reason" autoFocus value={reason} maxLength={REASON_MAX} rows={3}
          onChange={e => setReason(e.target.value)} placeholder={t('work.detachReasonPlaceholder')}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', resize: 'vertical', outline: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onCancel}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
            {t('common:cancel')}
          </button>
          <button type="button" onClick={() => trimmed && onConfirm(trimmed)} disabled={disabled}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
              background: 'var(--color-danger)', color: 'var(--color-on-danger)',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
            {submitting ? t('common:saving') : t('work.detachConfirm')}
          </button>
        </div>
    </FloatingPanel>
  )
}
