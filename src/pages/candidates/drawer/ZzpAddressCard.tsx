/**
 * ZzpAddressCard — the ZZP tab's own Adres card (VAT-ADDRESS-1, Danny 05-08 point
 * 1.1.1/1.1.2). Street/number/suffix/postcode/city collapse into ONE composed line
 * in read mode (`composeAddressLine`, the same shared function the candidate
 * profile and customer drawers use for their own 'address' composite) and expand
 * to loose fields while editing; province + land stay their OWN rows below the
 * composed line, both searchable pick-only dropdowns (CreatableSelect,
 * allowCreate=false — never a plain `<select>` or free text).
 *
 * NOT built on the generic EditableFieldTable, unlike its Bedrijf/Facturatie
 * siblings: province must CASCADE on the country picked in the SAME edit session
 * (clearing a now-invalid province the instant country changes — mirrors
 * AddLocationModal's PROVINCIE-1 cascade). EditableFieldTable's field types
 * render independently with no way for one field to read another's live draft
 * value — ContactDetail.tsx documents the exact same limitation for its own
 * location/department coupling, which is why that one also got its own small
 * self-contained edit block instead of a plain FieldRow pair. This card owns its
 * own local form state for the same reason, exactly like the candidate profile's
 * own ProfileAddressTab (same cascade, same author). Visual chrome (card/row/
 * pencil) reuses profileFieldShared so it still looks pixel-identical to its
 * EditableFieldTable-based siblings in the same tab.
 *
 * `useTranslation('common')` + bare keys (not profileFieldShared's own
 * `t('common:edit')` cross-namespace form) on purpose — this file's sibling test
 * suite (ZzpTab.test.tsx) runs WITHOUT real i18n initialised, like the rest of
 * this drawer's non-Profile tests, and the cross-namespace `ns:key` syntax only
 * resolves correctly once real i18n is loaded (verified: it renders literally as
 * "common:edit" otherwise) — `useTranslation('common')` + `t('edit')` is the
 * convention EditableFieldTable itself already uses, so this stays consistent
 * both in real i18n AND in the raw-key test fallback.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { composeAddressLine } from '@/components/forms/EditableFieldTable'
import { GroupCard, GroupHeader, FieldRow, inputStyle } from './profileFieldShared'
import Button from '@/components/ui/Button'
import { useProvinces } from '@/hooks/useProvinces'
import { useCountriesLookup } from '@/lib/useCountriesLookup'
import { getCountryName } from '@/lib/countries'

// The composite's fixed shape — matches composeAddressLine's expected keys
// (street/houseNumber/houseNumberSuffix/postalCode/city) plus the two rows below.
export interface ZzpAddressValues {
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  city: string
  province: string
  country: string
}

const EMPTY: ZzpAddressValues = { street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', province: '', country: '' }

export default function ZzpAddressCard({ value, onSave }: { value: ZzpAddressValues; onSave: (v: ZzpAddressValues) => void }) {
  const { t, i18n } = useTranslation('candidates')
  const { t: tc } = useTranslation('common')
  // COUNTRIES-LOOKUP-1 (task point 2): the tenant OPERATING-country whitelist —
  // deliberately NOT lib/countries' full ISO-3166 list, which is what the
  // candidate's own personal address (ProfileAddressTab) uses instead.
  const { options: countryOptions } = useCountriesLookup()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ZzpAddressValues>({ ...EMPTY, ...value })
  const setF = (k: keyof ZzpAddressValues, v: string) => setForm(p => ({ ...p, [k]: v }))

  // Province list CASCADES on the picked country (own cache slot per country,
  // useProvinces) — clears a province that no longer exists once the resolved
  // list for the NEWLY picked country lands (mirrors AddLocationModal's
  // PROVINCIE-1 cascade-clear exactly).
  const { provinces } = useProvinces(form.country)
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) setF('province', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

  const start  = () => { setForm({ ...EMPTY, ...value }); setEditing(true) }
  const cancel = () => { setForm({ ...EMPTY, ...value }); setEditing(false) }
  const save   = () => { onSave(form); setEditing(false) }

  const line = composeAddressLine(value as unknown as Record<string, unknown>)
  const countryLabel = value.country ? getCountryName(value.country, i18n.language) : ''

  return (
    <div>
      <GroupHeader title={t('zzp.groupAddress')}>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button variant="primary" size="sm" iconOnly onClick={save} title={tc('save')} aria-label={tc('save')}><Save size={13} /></Button>
            <Button variant="secondary" size="sm" iconOnly onClick={cancel} title={tc('cancel')} aria-label={tc('cancel')}><X size={13} /></Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" iconOnly onClick={start} title={tc('edit')} aria-label={tc('edit')}><Edit2 size={13} /></Button>
        )}
      </GroupHeader>
      <GroupCard>
        {editing ? (
          <>
            <FieldRow label={t('zzp.street')}><input value={form.street} onChange={e => setF('street', e.target.value)} style={inputStyle} /></FieldRow>
            <FieldRow label={t('zzp.houseNumber')}><input value={form.houseNumber} onChange={e => setF('houseNumber', e.target.value)} style={inputStyle} /></FieldRow>
            {/* Reuses the candidate's own personal-address label (same word, same namespace) — no new key needed. */}
            <FieldRow label={t('profile.houseNumberSuffix')}><input value={form.houseNumberSuffix} onChange={e => setF('houseNumberSuffix', e.target.value)} style={inputStyle} /></FieldRow>
            <FieldRow label={t('zzp.postalCode')}><input value={form.postalCode} onChange={e => setF('postalCode', e.target.value)} style={inputStyle} /></FieldRow>
            <FieldRow label={t('zzp.city')}><input value={form.city} onChange={e => setF('city', e.target.value)} style={inputStyle} /></FieldRow>
          </>
        ) : (
          <FieldRow label={t('profile.address')}>
            <span style={{ fontSize: 12, color: line ? 'var(--text)' : 'var(--text-muted)' }}>{line || '-'}</span>
          </FieldRow>
        )}
        {/* Provincie/land stay their own rows below the composed line, searchable
            pick-only dropdowns — never a plain <select> or free text (task point 2). */}
        <FieldRow label={t('profile.province')}>
          {editing
            ? <CreatableSelect value={form.province || null} onChange={v => setF('province', v)} allowCreate={false}
                placeholder={tc('select')} style={inputStyle} options={provinces.map(p => ({ value: p, label: p }))} />
            : <span style={{ fontSize: 12, color: value.province ? 'var(--text)' : 'var(--text-muted)' }}>{value.province || '-'}</span>}
        </FieldRow>
        <FieldRow label={t('zzp.country')}>
          {editing
            ? <CreatableSelect value={form.country || null} onChange={v => setF('country', v)} allowCreate={false}
                placeholder={tc('select')} style={inputStyle} options={countryOptions} />
            : <span style={{ fontSize: 12, color: countryLabel ? 'var(--text)' : 'var(--text-muted)' }}>{countryLabel || '-'}</span>}
        </FieldRow>
      </GroupCard>
    </div>
  )
}
