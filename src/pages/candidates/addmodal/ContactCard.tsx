/**
 * ContactCard — the "Contact" card: email, then phone/mobile paired (job B P1-follow-up).
 * Pure presentational: form values in, `set()` callback out.
 */
import { useTranslation } from 'react-i18next'
import type { FormState } from '../AddCandidateModal'
import { Field, TextField, cardHead, cardBox, row } from './fields'

interface ContactCardProps {
  form: FormState
  errors: Record<string, boolean>
  set: (k: keyof FormState, v: string) => void
  isReq: (k: keyof FormState) => boolean
}

export default function ContactCard({ form, errors, set, isReq }: ContactCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardContact')}</div>
      <div style={cardBox}>
        <Field label={t('modal.fields.email')} required={isReq('email')}>
          <TextField type="email" value={form.email} onChange={v => set('email', v)} placeholder={t('modal.fields.emailPlaceholder')} error={errors.email} />
        </Field>
        <div style={row('1fr 1fr')}>
          <Field label={t('modal.fields.phone')} required={isReq('phone')}>
            <TextField type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder={t('modal.fields.phonePlaceholder')} error={errors.phone} />
          </Field>
          <Field label={t('modal.fields.mobile')}>
            <TextField type="tel" value={form.mobile} onChange={v => set('mobile', v)} placeholder={t('modal.fields.mobilePlaceholder')} />
          </Field>
        </div>
      </div>
    </div>
  )
}
