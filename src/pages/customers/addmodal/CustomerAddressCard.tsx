/**
 * CustomerAddressCard — the customer's own visiting address (KLANT-ADRES-1), added
 * so the "+ Klant" create form mirrors "+ Kandidaat" 1:1 (Danny 02-08: "de + nieuwe
 * klant popup moet lijken op + nieuwe kandidaat"). Full-width, three rows — street/
 * no/suffix, postcode/city, province/country — exactly like AddCandidateModal's own
 * AddressCard; the country/province cascade is the same shared useProvinces hook.
 * Labels reuse the customers namespace's existing `locations.detail.*` keys (the
 * SAME labels the drawer's OverviewTab already uses for this customer's address),
 * so this is one label per field, not a second translated copy. Pure
 * presentational: form values in, `set()` callback out.
 *
 * Renamed from `AddressCard.tsx` (housekeeping, 2026-08-03 addmodal/locationmodal
 * consolidation): a second address card was about to land for AddLocationModal
 * (`LocationAddressCard`) in this same folder — a bare `AddressCard` next to it
 * would read as ambiguous. No behaviour change, import path only.
 */
import { useTranslation } from 'react-i18next'
import type { CustomerForm } from '../AddCustomerModal'
import { FieldRow, TextField } from '@/components/forms/fields'
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
        {/* KLANT-LAYOUT-4 (Danny 14-08 "Straat is veel te klein"): three label-left
            fields on one grid row left each input a stub, since every cell also
            carries the ~120px canon label. Street owns its own row; house number
            and suffix stay paired below it. */}
        <FieldRow label={t('locations.detail.street')}>
          <TextField value={form.street} onChange={v => set('street', v)} />
        </FieldRow>
        <div style={row('1fr 1fr')}>
          <FieldRow label={t('locations.detail.houseNumber')}>
            <TextField value={form.houseNumber} onChange={v => set('houseNumber', v)} />
          </FieldRow>
          <FieldRow label={t('locations.detail.houseNumberSuffix')}>
            <TextField value={form.houseNumberSuffix} onChange={v => set('houseNumberSuffix', v)} />
          </FieldRow>
        </div>
        {/* KLANTEN 2.3 (walkthrough 21-08): postcode en plaats elk een volle rij —
            in de 1fr/2fr-split at de canon-labelbreedte het postcodeveld op. */}
        <FieldRow label={t('locations.detail.postalCode')}>
          <TextField value={form.postalCode} onChange={v => set('postalCode', v)} />
        </FieldRow>
        <FieldRow label={t('modal.fields.city')}>
          <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} />
        </FieldRow>
        <div style={row('1fr 1fr')}>
          {/* Sends `province` (the backend's preferred key, per CustomerRequest — `state`
              is only a legacy input alias) — the same key the candidate's home address uses. */}
          <FieldRow label={t('locations.detail.state')}>
            {/* CLEAR-SWEEP (Danny 13-08): province is in OPTIONAL_CREATE_FIELDS
                (useCustomerRecord) — omitted from the create body entirely when
                empty — so clearable. */}
            <CreatableSelect value={form.province || null} onChange={(v: string) => set('province', v)} allowCreate={false}
              clearable clearLabel={t('locations.detail.state')}
              placeholder={t('common:select')} options={provinces} menuWidth={260} />
          </FieldRow>
          <FieldRow label={t('locations.detail.country')}>
            {/* CLEAR-SWEEP: country is in OPTIONAL_CREATE_FIELDS the same way. */}
            <CreatableSelect value={form.country || null} onChange={(v: string) => set('country', v)} allowCreate={false}
              clearable clearLabel={t('locations.detail.country')}
              placeholder={t('common:select')} options={countryOptions} menuWidth={260} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}
