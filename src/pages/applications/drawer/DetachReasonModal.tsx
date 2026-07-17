import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Unlink } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }
const panel: CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 71,
  width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 20,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}
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
  const panelRef = useFocusTrap<HTMLDivElement>(onCancel)
  const trimmed = reason.trim()

  return (
    <>
      <div style={overlay} onClick={onCancel} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('detach.reasonTitle')} tabIndex={-1}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><Unlink size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('detach.reasonTitle')}</span>
          <button onClick={onCancel} aria-label={t('common:close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('detach.reasonLabel')}</label>
        <textarea autoFocus value={reason} maxLength={REASON_MAX} onChange={e => setReason(e.target.value)}
          placeholder={t('detach.reasonPlaceholder')} rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', resize: 'vertical', outline: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onCancel} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)',
            borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            {t('common:cancel')}
          </button>
          <button onClick={() => trimmed && onConfirm(trimmed)} disabled={!trimmed || submitting}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
              background: 'var(--color-danger)', color: '#fff', cursor: (!trimmed || submitting) ? 'not-allowed' : 'pointer',
              opacity: (!trimmed || submitting) ? 0.6 : 1 }}>
            {t('detach.confirm')}
          </button>
        </div>
      </div>
    </>
  )
}
