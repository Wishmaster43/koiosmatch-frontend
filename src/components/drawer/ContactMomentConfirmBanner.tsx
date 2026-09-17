/**
 * ContactMomentConfirmBanner (B15-flow, promoted LAATSTE-CONTACT-SCOPE-1) — the
 * small, non-blocking confirmation shown after a mailto: click: "Sent the
 * e-mail? Register as contact moment." Never blocks the drawer — it renders
 * inline, right under the field, and dismissing it is a real no-op (no forced
 * choice, §3 "no fake affordances" cuts both ways: an honest optional prompt,
 * not a modal). Shared by the candidate and customer-contact drawers (§2 —
 * machinery two entities share lives in components/, never a per-entity copy).
 */
import { useTranslation } from 'react-i18next'
import { Mail } from 'lucide-react'
import Button from '@/components/ui/Button'
import { tintBg, chipInk } from '@/lib/tint'

// Channels this banner can confirm; the candidate flow only wires 'email' today,
// the type stays wider so a future phone/mobile confirm needs no new shape.
export type ContactChannel = 'email' | 'phone' | 'mobile'

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
      borderRadius: 7, border: '1px solid var(--color-info)', background: tintBg('var(--color-info)') }}>
      <Mail size={13} style={{ color: 'var(--color-info)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>
        {t('profile.contactMomentQuestion')} {t('profile.contactMomentRegister')}
      </span>
      {/* Text on its own tint reads chipInk, never the raw colour (§4/§6, measured 2.4-3.0:1 in lib/tint.ts). */}
      <Button variant="ghost" size="sm" onClick={onConfirm} disabled={saving} data-testid={`contact-moment-confirm-${channel}`}
        style={{ color: chipInk('var(--color-info)'), fontWeight: 600 }}>
        {t('common:confirm', { defaultValue: 'OK' })}
      </Button>
      <Button variant="ghost" size="sm" onClick={onDismiss} disabled={saving}>
        {t('profile.contactMomentDismiss')}
      </Button>
    </div>
  )
}
