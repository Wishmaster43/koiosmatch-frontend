/**
 * AddressCard — the "Adres" card, always open (Danny r2: popup groter, geen inklap).
 * Pure presentational: form values in, `set()` callback out.
 */
import { useTranslation } from 'react-i18next'
import type { FormState } from '../AddCandidateModal'
import { Field, TextField, CreatableSelect, cardHead, cardBox, row } from './fields'
import { getCountryOptions } from '@/lib/countries'

interface AddressCardProps {
  form: FormState
  errors: Record<string, boolean>
  set: (k: keyof FormState, v: string) => void
  isReq: (k: keyof FormState) => boolean
  provinces: string[]
}

export default function AddressCard({ form, errors, set, isReq, provinces }: AddressCardProps) {
  const { t, i18n } = useTranslation(['candidates', 'common'])
  // COUNTRY-1: fixed ISO-3166 code list, localized to the current UI language —
  // never a tenant lookup (mirrors the provinces list passed in above).
  const countryOptions = getCountryOptions(i18n.language)
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={cardHead}>{t('modal.fields.cardAddress')}</div>
      <div style={cardBox}>
        <div style={row('2fr 1fr 1fr')}>
          <Field label={t('modal.fields.street')} required={isReq('street')}>
            <TextField value={form.street} onChange={v => set('street', v)} placeholder={t('modal.fields.streetPlaceholder')} error={errors.street} />
          </Field>
          <Field label={t('modal.fields.houseNumber')}>
            <TextField value={form.houseNumber} onChange={v => set('houseNumber', v)} />
          </Field>
          <Field label={t('modal.fields.houseNumberSuffix')}>
            <TextField value={form.houseNumberSuffix} onChange={v => set('houseNumberSuffix', v)} />
          </Field>
        </div>
        <div style={row('1fr 2fr')}>
          <Field label={t('modal.fields.postalCode')} required={isReq('postalCode')}>
            <TextField value={form.postalCode} onChange={v => set('postalCode', v)} error={errors.postalCode} />
          </Field>
          <Field label={t('modal.fields.city')} required={isReq('city')}>
            <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} error={errors.city} />
          </Field>
        </div>
        <div style={row('1fr 1fr')}>
          <Field label={t('modal.fields.province')}>
            <CreatableSelect value={form.province || null} onChange={(v: string) => set('province', v)} allowCreate={false}
              placeholder={t('common:select')} options={provinces} menuWidth={260} />
          </Field>
          <Field label={t('modal.fields.country')}>
            <CreatableSelect value={form.country || null} onChange={(v: string) => set('country', v)} allowCreate={false}
              placeholder={t('common:select')} options={countryOptions} menuWidth={260} />
          </Field>
        </div>
      </div>
    </div>
  )
}
