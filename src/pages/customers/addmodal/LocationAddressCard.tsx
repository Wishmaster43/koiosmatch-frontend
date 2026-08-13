/**
 * LocationAddressCard — the "Adres" card of AddLocationModal: street/house
 * number/suffix, postcode/city, province/country. Extracted (§0.3 — the
 * ~400-line split trigger, 2026-08-03); pure presentational, every value and
 * callback comes from the parent's own form state. The province cascade
 * (clearing a stale province on country change) stays in the container — it
 * needs to own the `provinces` list AND the form-clearing effect together.
 *
 * `country` stays a plain text field on purpose: unlike the candidate's ISO-2
 * `country` code, this one is a free-text string (BE `country` column, default
 * "Nederland") with no lookup behind it (see AddLocationModal's file header).
 */
import { useTranslation } from 'react-i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2, row } from '@/components/ui/modalCards'

// FIELD-HEIGHT-1: same literal as the parent modal's own `pickerStyle` (kept
// local since this is the only field in this card that needs it).
const pickerStyle = { padding: '8px 11px', borderRadius: 8, fontSize: 13 } as const

// Weighted rows for the address block (mirrors the candidate AddressCard's own
// street/postcode ratios — the same real-world field, same proportions).
const rowStreet = row('2fr 1fr 1fr')
const rowPostal = row('1fr 2fr')

interface LocationAddressCardProps {
  street: string; onStreetChange: (v: string) => void
  houseNumber: string; onHouseNumberChange: (v: string) => void
  houseNumberSuffix: string; onHouseNumberSuffixChange: (v: string) => void
  postalCode: string; onPostalCodeChange: (v: string) => void
  city: string; onCityChange: (v: string) => void
  state: string; onStateChange: (v: string) => void
  country: string; onCountryChange: (v: string) => void
  provinces: string[]
}

export default function LocationAddressCard({
  street, onStreetChange, houseNumber, onHouseNumberChange, houseNumberSuffix, onHouseNumberSuffixChange,
  postalCode, onPostalCodeChange, city, onCityChange, state, onStateChange, country, onCountryChange, provinces,
}: LocationAddressCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('subModal.groups.address')}</div>
      <div style={cardBox}>
        <div style={rowStreet}>
          <FieldRow label={t('subModal.street')}><TextField value={street} onChange={onStreetChange} /></FieldRow>
          <FieldRow label={t('subModal.houseNumber')}><TextField value={houseNumber} onChange={onHouseNumberChange} /></FieldRow>
          <FieldRow label={t('subModal.houseNumberSuffix')}><TextField value={houseNumberSuffix} onChange={onHouseNumberSuffixChange} /></FieldRow>
        </div>
        <div style={rowPostal}>
          <FieldRow label={t('subModal.postalCode')}><TextField value={postalCode} onChange={onPostalCodeChange} placeholder="1234 AB" /></FieldRow>
          <FieldRow label={t('subModal.city')}><TextField value={city} onChange={onCityChange} /></FieldRow>
        </div>
        <div style={row2}>
          {/* PROVINCIE-1 (Danny 02-08: "provincie heeft geen zoekbare dropdown???"):
              a searchable picker fed by the same shared useProvinces hook the
              customer's own AddressCard uses. Sends `state` (unchanged wire key):
              CustomerLocationController aliases `state` onto `province`
              server-side whenever `province` itself is absent
              (normaliseLegacyKeys) — verified in the controller source, so this
              is not a silently-dropped key, just the legacy name. */}
          <FieldRow label={t('subModal.state')}>
            {/* CLEAR-SWEEP (Danny 13-08): optional — useCustomerLocations.toApi sends
                `state` through as-is (nullable column), so an explicit '' clear reaches
                the saved state, never silently dropped. */}
            <CreatableSelect value={state || null} onChange={onStateChange} allowCreate={false}
              clearable clearLabel={t('subModal.state')}
              placeholder={t('common:select')} options={provinces} menuWidth={260} style={pickerStyle} />
          </FieldRow>
          {/* `country` stays free text on purpose — see file header comment. */}
          <FieldRow label={t('subModal.country')}><TextField value={country} onChange={onCountryChange} /></FieldRow>
        </div>
      </div>
    </div>
  )
}
