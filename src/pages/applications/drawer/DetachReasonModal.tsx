import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Unlink } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'

const REASON_MAX = 1000

interface Props {
  onCancel: () => void
  onConfirm: (reason: string) => void
  submitting?: boolean
}

/**
 * DetachReasonModal — S15: the backend now REQUIRES a reason to detach an
 * application (`DELETE /applications/{id}` 422s without one) and stores it as a
 * timeline/notes trail entry, so this is a small, honest confirm step rather
 * than a silent action. The reason is a plain string (BE validates
 * `string|max:1000`, not rich content) — a RichTextEditor would be overkill for
 * a short structured "why", mirroring other reason prompts in this app.
 */
export default function DetachReasonModal({ onCancel, onConfirm, submitting }: Props) {
  const { t } = useTranslation(['applications', 'common'])
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  return (
    // POPUP-SLEEP-1: shell swapped onto the shared FloatingPanel (draggable/
    // resizable, remembered position) — body/footer and flows unchanged.
    <FloatingPanel open onClose={onCancel} ariaLabel={t('detach.reasonTitle')}
      persistKey="application-detach-reason" width={420} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><Unlink size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('detach.reasonTitle')}</span>
        </span>
      }>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('detach.reasonLabel')}</label>
        <textarea autoFocus value={reason} maxLength={REASON_MAX} onChange={e => setReason(e.target.value)}
          placeholder={t('detach.reasonPlaceholder')} rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', resize: 'vertical', outline: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Button variant="secondary" onClick={onCancel}>
            {t('common:cancel')}
          </Button>
          <Button variant="danger" onClick={() => trimmed && onConfirm(trimmed)} disabled={!trimmed || submitting}>
            {t('detach.confirm')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
