/**
 * ModalFooter — Cancel + Create buttons. Pure presentational: submit-readiness
 * flags in, `onClose`/`onSubmit` callbacks out. Mirrors ModalHeader's own
 * `useTranslation` call (buttons render via the shared Button, sm standard — DE MAAT).
 */
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'

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

// Cancel/Create footer; the Create label names the picked phase when one exists, otherwise falls back to a generic wording.
export default function ModalFooter({ onClose, onSubmit, canSubmit, saving, hasType, statusLabel }: ModalFooterProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
      display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
      <Button variant="secondary" onClick={onClose}>
        {t('common:cancel')}
      </Button>
      <Button variant="primary" onClick={onSubmit} disabled={!canSubmit || saving}>
        {saving ? t('common:saving', 'Opslaan…') : hasType ? t('modal.create', { type: statusLabel }) : t('modal.createGeneric')}
      </Button>
    </div>
  )
}
