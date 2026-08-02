/**
 * AddressCard — the customer's own visiting address (KLANT-ADRES-1), added so the
 * "+ Klant" create form mirrors "+ Kandidaat" 1:1 (Danny 02-08: "de + nieuwe klant
 * popup moet lijken op + nieuwe kandidaat"). Full-width, three rows — street/no/
 * suffix, postcode/city, province/country — exactly like AddCandidateModal's own
 * AddressCard; the country/province cascade is the same shared useProvinces hook.
 * Labels reuse the customers namespace's existing `locations.detail.*` keys (the
 * SAME labels the drawer's OverviewTab already uses for this customer's address),
 * so this is one label per field, not a second translated copy. Pure
 * presentational: form values in, `set()` callback out.
 */
import { useTranslation } from 'react-i18next'
import type { CustomerForm } from '../AddCustomerModal'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row } from '@/components/ui/modalCards'
import { getCountryOptions } from '@/lib/countries'

interface AddressCardProps {
  form: CustomerForm
  set: (k: keyof CustomerForm, v: string) => void
  provinces: string[]
}

export default function AddressCard({ form, set, provinces }: AddressCardProps) {
  const { t, i18n } = useTranslation(['customers', 'common'])
  // Fixed ISO-3166 code list, localized to the current UI language — mirrors the
  // candidate's own country picker (COUNTRY-1), never a tenant lookup.
  const countryOptions = getCountryOptions(i18n.language)
  return (
    <div>
      {/* Reuses the drawer's own "Adres" heading (overview.address) — one label for
          the same concept in the create form and the drawer's address block. */}
      <div style={cardHead}>{t('overview.address')}</div>
      <div style={cardBox}>
        <div style={row('2fr 1fr 1fr')}>
          <Field label={t('locations.detail.street')}>
            <TextField value={form.street} onChange={v => set('street', v)} />
          </Field>
          <Field label={t('locations.detail.houseNumber')}>
            <TextField value={form.houseNumber} onChange={v => set('houseNumber', v)} />
          </Field>
          <Field label={t('locations.detail.houseNumberSuffix')}>
            <TextField value={form.houseNumberSuffix} onChange={v => set('houseNumberSuffix', v)} />
          </Field>
        </div>
        <div style={row('1fr 2fr')}>
          <Field label={t('locations.detail.postalCode')}>
            <TextField value={form.postalCode} onChange={v => set('postalCode', v)} />
          </Field>
          <Field label={t('modal.fields.city')}>
            <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} />
          </Field>
        </div>
        <div style={row('1fr 1fr')}>
          {/* Sends `province` (the backend's preferred key, per CustomerRequest — `state`
              is only a legacy input alias) — the same key the candidate's home address uses. */}
          <Field label={t('locations.detail.state')}>
            <CreatableSelect value={form.province || null} onChange={(v: string) => set('province', v)} allowCreate={false}
              placeholder={t('common:select')} options={provinces} menuWidth={260} />
          </Field>
          <Field label={t('locations.detail.country')}>
            <CreatableSelect value={form.country || null} onChange={(v: string) => set('country', v)} allowCreate={false}
              placeholder={t('common:select')} options={countryOptions} menuWidth={260} />
          </Field>
        </div>
      </div>
    </div>
  )
}
