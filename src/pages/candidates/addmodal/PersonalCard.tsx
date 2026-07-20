/**
 * PersonalCard — the "Persoonlijk" card: name row + birthdate/gender pair.
 * Pure presentational: form values in, `set()` callback out; validation state
 * (`errors`/`isReq`) is computed by the container and only rendered here.
 */
import { useTranslation } from 'react-i18next'
import type { FormState } from '../AddCandidateModal'
import { Field, TextField, CreatableSelect, cardHead, cardBox, row, type FieldOption } from './fields'

interface PersonalCardProps {
  form: FormState
  errors: Record<string, boolean>
  set: (k: keyof FormState, v: string) => void
  isReq: (k: keyof FormState) => boolean
  genderOptions: FieldOption[]
}

export default function PersonalCard({ form, errors, set, isReq, genderOptions }: PersonalCardProps) {
  const { t } = useTranslation(['candidates', 'common'])
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{t('modal.fields.cardPersonal')}</div>
      <div style={cardBox}>
        <div style={row('2fr 1fr 2fr')}>
          <Field label={t('modal.fields.firstName')} required={isReq('firstName')}>
            <TextField value={form.firstName} onChange={v => set('firstName', v)} placeholder={t('modal.fields.firstName')} error={errors.firstName} />
            {errors.firstName && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('common:required')}</div>}
          </Field>
          <Field label={t('modal.fields.middleName')}>
            <TextField value={form.middleName} onChange={v => set('middleName', v)} placeholder="van" />
          </Field>
          <Field label={t('modal.fields.lastName')} required={isReq('lastName')}>
            <TextField value={form.lastName} onChange={v => set('lastName', v)} placeholder={t('modal.fields.lastName')} error={errors.lastName} />
            {errors.lastName && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('common:required')}</div>}
          </Field>
        </div>
        <div style={row('1fr 1fr')}>
          <Field label={t('modal.fields.dob')} required={isReq('dateOfBirth')}>
            <TextField type="date" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} error={errors.dateOfBirth} />
          </Field>
          <Field label={t('modal.fields.gender')} required={isReq('gender')}>
            <CreatableSelect value={form.gender || null} onChange={(v: string) => set('gender', v)} allowCreate={false}
              placeholder={t('common:select')} options={genderOptions} menuWidth={220} />
          </Field>
        </div>
      </div>
    </div>
  )
}
