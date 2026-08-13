/**
 * ContactCard — the "Contact" card: email, then phone/mobile paired (job B P1-follow-up),
 * plus LinkedIn (CONTACT-LINKEDIN-1 — mirrors the customer contact modal's own
 * ContactDetailsCard, which already ships this exact field). Pure presentational:
 * form values in, `set()`/`onBlur()` callbacks out, an already-resolved message
 * string per field in (VALIDATIE-LIVE-1 — the live format check + any 422 field
 * error live in the container, this card only renders what it's given).
 *
 * The onBlur wiring here is a plain wrapper `<div onBlur>` around each field
 * rather than a prop on TextField itself: the shared `components/forms/fields`
 * TextField has no onBlur in its type or implementation, and widening that
 * app-wide primitive is out of scope for this change — a blur on a descendant
 * input still bubbles up to the wrapping div (React's onBlur uses the
 * bubbling `focusout` event), so this needs no change to the shared component.
 */
import { useTranslation } from 'react-i18next'
import type { FormState } from '../AddCandidateModal'
import { CvField, TextField, cardHead, cardBox } from './fields'
import FieldNotice from '@/components/ui/FieldNotice'

// The live-validation/422 message under a field — one shared renderer now
// (components/ui/FieldNotice), not a per-modal copy.

interface ContactCardProps {
  form: FormState
  errors: Record<string, boolean>
  set: (k: keyof FormState, v: string) => void
  isReq: (k: keyof FormState) => boolean
  // VALIDATIE-LIVE-1: blur marks a field "touched" so its live format error can
  // render; fieldMessage resolves the message to show (422 wins over a live check).
  onBlur: (k: keyof FormState) => void
  fieldMessage: (k: keyof FormState) => string | undefined
}

export default function ContactCard({ form, errors, set, isReq, onBlur, fieldMessage }: ContactCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardContact')}</div>
      <div style={cardBox}>
        <div onBlur={() => onBlur('email')}>
          <CvField name="email" label={t('modal.fields.email')} required={isReq('email')}>
            <TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder={t('modal.fields.emailPlaceholder')} error={errors.email || !!fieldMessage('email')} />
          </CvField>
          <FieldNotice text={fieldMessage('email')} />
        </div>
        {/* Phone and mobile each get a FULL row (Danny 14-08 "Telefoon en mobiel
            past niet"): paired half-width label-left rows squeezed the inputs to
            postage stamps inside this half-width card. */}
        <div onBlur={() => onBlur('phone')}>
          <CvField name="phone" label={t('modal.fields.phone')} required={isReq('phone')}>
            <TextField type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder={t('modal.fields.phonePlaceholder')} error={errors.phone || !!fieldMessage('phone')} />
          </CvField>
          <FieldNotice text={fieldMessage('phone')} />
        </div>
        <div onBlur={() => onBlur('mobile')}>
          <CvField name="mobile" label={t('modal.fields.mobile')}>
            <TextField type="tel" value={form.mobile} onChange={v => set('mobile', v)} placeholder={t('modal.fields.mobilePlaceholder')} error={!!fieldMessage('mobile')} />
          </CvField>
          <FieldNotice text={fieldMessage('mobile')} />
        </div>
        <div onBlur={() => onBlur('linkedin')}>
          <CvField name="linkedin" label={t('modal.fields.linkedin')}>
            <TextField value={form.linkedin} onChange={v => set('linkedin', v)} placeholder={t('modal.fields.linkedinPlaceholder')} error={!!fieldMessage('linkedin')} />
          </CvField>
          <FieldNotice text={fieldMessage('linkedin')} />
        </div>
      </div>
    </div>
  )
}
