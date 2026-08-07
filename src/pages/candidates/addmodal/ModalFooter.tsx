/**
 * ModalFooter — Cancel + Create buttons. Pure presentational: submit-readiness
 * flags in, `onClose`/`onSubmit` callbacks out. Mirrors ModalHeader's own
 * `useTranslation` call (BTN_H stays the one explicit button-height source, §4/§9).
 */
import { useTranslation } from 'react-i18next'
import { BTN_H } from '@/config/buttonMetrics'

interface ModalFooterProps {
  onClose: () => void
  onSubmit: () => void
  canSubmit: boolean
  saving: boolean
  // Whether a phase (Lead/Kandidaat) is currently picked — drives the Create
  // label's wording ("Create <type>" vs. the generic fallback).
  hasType: boolean
  statusLabel: string
}

export default function ModalFooter({ onClose, onSubmit, canSubmit, saving, hasType, statusLabel }: ModalFooterProps) {
  const { t } = useTranslation(['candidates', 'common'])
  const enabled = canSubmit && !saving
  return (
    <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
      display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
      <button onClick={onClose}
        style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8,
          border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
        {t('common:cancel')}
      </button>
      <button onClick={onSubmit} disabled={!canSubmit || saving}
        style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
          background: enabled ? 'var(--color-primary)' : 'var(--border)',
          color: enabled ? 'white' : 'var(--text-muted)',
          cursor: enabled ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
        {saving ? t('common:saving', 'Opslaan…') : hasType ? t('modal.create', { type: statusLabel }) : t('modal.createGeneric')}
      </button>
    </div>
  )
}
