/**
 * PlacementCard — Inzet: contractvorm (multi), start/einddatum, the structured
 * address block (mirrors AddLocationModal's Adres card) and the vestiging
 * (bureau) picker.
 *
 * NAMING NOTE (punt 13): `branchId` here POSTs as `location_id` — the TENANT'S
 * OWN establishment (`/locations`, useLocations()). This is a DIFFERENT concept
 * from `customer_location_id` in ClientCascadeCard, which is the KLANT's own
 * site picked via the cascade. Two different "location" ideas that have been
 * confused in this codebase before — keep the naming apart everywhere.
 */
import { useTranslation } from 'react-i18next'
import { FieldRow, TextField, DateField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { getCountryOptions } from '@/lib/countries'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface CandidateType { value: string; label: string; color?: string }
type AddressKey = 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city' | 'province' | 'country'

interface Props {
  contractTypes: string[]; candidateTypes: CandidateType[]; onToggleType: (v: string) => void
  startDate: string; endDate: string; onStartDateChange: (v: string) => void; onEndDateChange: (v: string) => void
  street: string; houseNumber: string; houseNumberSuffix: string; postalCode: string; city: string; province: string; country: string
  onFieldChange: (k: AddressKey, v: string) => void
  provinces: string[]
  branchId: string; onBranchChange: (v: string) => void
  branchOptions: Array<{ value: string; label: string }>
}

export default function PlacementCard({
  contractTypes, candidateTypes, onToggleType, startDate, endDate, onStartDateChange, onEndDateChange,
  street, houseNumber, houseNumberSuffix, postalCode, city, province, country, onFieldChange, provinces,
  branchId, onBranchChange, branchOptions,
}: Props) {
  const { t, i18n } = useTranslation(['vacancies', 'common'])
  const countryOptions = getCountryOptions(i18n.language)

  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardPlacement')}</div>
      <div style={cardBox}>
        {/* Contractvorm — multi-value soft-chip toggle (mirrors DetailsGeneralTab's edit mode). */}
        <FieldRow label={t('details.contractType')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {candidateTypes.map(ctype => {
              const on = contractTypes.includes(ctype.value)
              const c = ctype.color ?? 'var(--color-primary)'
              return (
                <button key={ctype.value} type="button" onClick={() => onToggleType(ctype.value)} aria-pressed={on}
                  style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: on ? 600 : 400,
                    background: on ? `color-mix(in srgb, ${c} 14%, transparent)` : 'var(--surface)',
                    color: on ? c : 'var(--text-muted)',
                    border: `1px solid ${on ? c : 'var(--border)'}` }}>{ctype.label}</button>
              )
            })}
          </div>
        </FieldRow>
        <FieldRow label={t('details.startDate')}>
          <DateField value={startDate} onChange={onStartDateChange} placeholder={t('common:select')} />
        </FieldRow>
        <FieldRow label={t('details.endDate')}>
          <DateField value={endDate} onChange={onEndDateChange} placeholder={t('common:select')} />
        </FieldRow>
        {/* Structured address — mirrors AddLocationModal's Adres card grouping;
            each segment is its own label-left row so each input keeps its OWN
            accessible name (a wrapping div's aria-labelledby does not reach a
            nested input — grouping these under one shared label broke a11y). */}
        <FieldRow label={t('details.street')}>
          <TextField value={street} onChange={v => onFieldChange('street', v)} />
        </FieldRow>
        <FieldRow label={t('details.houseNumber')}>
          <TextField value={houseNumber} onChange={v => onFieldChange('houseNumber', v)} />
        </FieldRow>
        <FieldRow label={t('details.houseNumberSuffix')}>
          <TextField value={houseNumberSuffix} onChange={v => onFieldChange('houseNumberSuffix', v)} />
        </FieldRow>
        <FieldRow label={t('details.postalCode')}>
          <TextField value={postalCode} onChange={v => onFieldChange('postalCode', v)} placeholder="1234 AB" />
        </FieldRow>
        <FieldRow label={t('details.city')}>
          <TextField value={city} onChange={v => onFieldChange('city', v)} />
        </FieldRow>
        <FieldRow label={t('details.province')}>
          <CreatableSelect value={province || null} onChange={(v: string) => onFieldChange('province', v)} allowCreate={false}
            clearable clearLabel={t('details.province')} placeholder={t('common:select')} options={provinces.map(p => ({ value: p, label: p }))} />
        </FieldRow>
        <FieldRow label={t('details.country')}>
          <CreatableSelect value={country || null} onChange={(v: string) => onFieldChange('country', v)} allowCreate={false}
            clearable clearLabel={t('details.country')} placeholder={t('common:select')} options={countryOptions} />
        </FieldRow>
        {/* Vestiging (bureau) — see this file's header comment for why this is a
            DIFFERENT field from the klant location above. */}
        <FieldRow label={t('modal.fields.branch')}>
          <CreatableSelect value={branchId || null} onChange={onBranchChange} allowCreate={false}
            clearable clearLabel={t('modal.fields.branch')} placeholder={t('common:select')} options={branchOptions} />
        </FieldRow>
      </div>
    </div>
  )
}
