/**
 * ContactMomentConfirmBanner (B15-flow) — the small, non-blocking confirmation
 * shown after a mailto: click: "Sent the e-mail? Register as contact moment."
 * Never blocks the drawer — it renders inline, right under the field, and
 * dismissing it is a real no-op (no forced choice, §3 "no fake affordances"
 * cuts both ways: an honest optional prompt, not a modal).
 */
import { useTranslation } from 'react-i18next'
import { Mail } from 'lucide-react'
import type { ContactChannel } from '../hooks/useContactMomentConfirm'

// Non-blocking inline prompt after a mailto: click, offering to log it as a
// real contact moment; dismissing is a genuine no-op, never a forced choice.
export default function ContactMomentConfirmBanner({ channel, saving, onConfirm, onDismiss }: {
  channel: ContactChannel
  saving: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation('candidates')
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, padding: '6px 10px',
      borderRadius: 7, border: '1px solid var(--color-info)', background: 'color-mix(in srgb, var(--color-info) 10%, transparent)' }}>
      <Mail size={13} style={{ color: 'var(--color-info)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>
        {t('profile.contactMomentQuestion')} {t('profile.contactMomentRegister')}
      </span>
      <button onClick={onConfirm} disabled={saving} data-testid={`contact-moment-confirm-${channel}`}
        style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-info)', background: 'none', border: 'none', cursor: saving ? 'default' : 'pointer', padding: '2px 4px' }}>
        {t('common:confirm', { defaultValue: 'OK' })}
      </button>
      <button onClick={onDismiss} disabled={saving}
        style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: saving ? 'default' : 'pointer', padding: '2px 4px' }}>
        {t('profile.contactMomentDismiss')}
      </button>
    </div>
  )
}
