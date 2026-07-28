import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useProvinces } from '@/hooks/useProvinces'
import { getCountryOptions, getCountryName } from '@/lib/countries'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import { FieldRow, EditControls, GroupCard, inputStyle } from './profileFieldShared'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// CreatableSelect is still untyped JS — accept any props at the boundary.
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

// The fields this sub-tab owns — split out of the old combined ProfileTab
// (Danny 28-07: one pencil flipping ~15 fields was unmaintainable).
type AddressKey = 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city' | 'province' | 'country'
type AddressForm = Record<AddressKey, string>

// Only street/postalCode/city are ever tenant-required among this tab's fields
// (mirrors the old PROFILE_REQ_MAP — houseNumber/suffix/province/country aren't).
const REQ_MAP: Partial<Record<AddressKey, string>> = { street: 'street', postalCode: 'postal_code', city: 'city' }

/** Address sub-tab — straat, huisnummer + toevoeging, postcode, plaats,
 *  provincie, land. Own pencil, own draft/error state; cancelling here never
 *  discards an in-progress edit in the Personal or Contact sub-tab.
 *  The street/no/suffix/postcode/city cluster keeps its exact composed
 *  one-line-read + expand-on-edit behaviour (mirrors the shared
 *  EditableFieldTable `type: 'address'` row — same pattern, same author). */
export default function ProfileAddressTab({ c, onSave, autoEditSignal }: {
  c: Candidate; onSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number
}) {
  const { t, i18n } = useTranslation('candidates')
  // COUNTRY-1: fixed ISO-3166 code list, localized to the current UI language —
  // never a tenant lookup (mirrors province's own non-tenant NL_PROVINCES list).
  const countryOptions = getCountryOptions(i18n.language)
  const requiredKeys = useProfileRequiredKeys(c.phase)
  const isReq = (key: AddressKey) => { const bk = REQ_MAP[key]; return !!bk && requiredKeys.includes(bk) }

  const emptyForm = (): AddressForm => ({
    street: c.street ?? '', houseNumber: c.houseNumber ?? '', houseNumberSuffix: c.houseNumberSuffix ?? '',
    postalCode: c.postalCode ?? '', city: c.city ?? '', province: c.province ?? '', country: c.country ?? '',
  })
  const [editing, setEditing] = useState(false)
  // Open edit mode when the parent bumps the signal (e.g. right after Lead→Kandidaat convert).
  const [prevAutoEdit, setPrevAutoEdit] = useState(autoEditSignal ?? 0)
  if ((autoEditSignal ?? 0) !== prevAutoEdit) { setPrevAutoEdit(autoEditSignal ?? 0); setEditing(true) }
  const [form, setForm] = useState<AddressForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<AddressKey, boolean>>>({})
  const setF = (k: AddressKey, v: string) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  // Province list CASCADES on the picked country (Danny addendum) — its own cache
  // slot per country (useProvinces), so switching country never leaks another
  // country's list in. If the country changes and the currently filled province no
  // longer exists in the new list, clear it rather than silently keep a mismatch.
  const { provinces } = useProvinces(form.country)
  useEffect(() => {
    if (form.province && !provinces.includes(form.province)) setF('province', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the resolved province list changing, not every form edit
  }, [provinces])

  // Block save when a required field of THIS tab is empty; flag the offenders.
  const save = () => {
    const e: Partial<Record<AddressKey, boolean>> = {}
    ;(Object.keys(REQ_MAP) as AddressKey[]).forEach(k => { if (isReq(k) && !String(form[k] ?? '').trim()) e[k] = true })
    if (Object.keys(e).length) { setErrors(e); return }
    onSave?.(form); setEditing(false); setErrors({})
  }
  const cancel = () => { setForm(emptyForm()); setErrors({}); setEditing(false) }

  // Province/country are pick-only (allowCreate=false) type-to-filter dropdowns
  // (Danny kandidaten-ronde-2, punt A / "moet een zoekbare dropdown") — never a
  // plain <select>: a long lookup list is easier to find by typing than scrolling.
  const renderInput = (key: AddressKey) => {
    if (key === 'province') return (
      <CreatableSelect value={form.province || null} onChange={(v: string) => setF('province', v)} allowCreate={false}
        placeholder={t('common:select')} style={inputStyle}
        options={provinces.map((p: string) => ({ value: p, label: p }))} />
    )
    if (key === 'country') return (
      <CreatableSelect value={form.country || null} onChange={(v: string) => setF('country', v)} allowCreate={false}
        placeholder={t('common:select')} style={inputStyle}
        options={countryOptions} />
    )
    return <input value={form[key]} onChange={e => setF(key, e.target.value)} style={inputStyle} />
  }

  // Country stores the ISO-2 code; resolve the localized display name (never the
  // bare code) via Intl.DisplayNames, re-evaluated per viewer language.
  const renderValue = (key: AddressKey) => {
    const v = c[key]
    if (key === 'country') {
      const label = v ? getCountryName(String(v), i18n.language) : ''
      return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{label || '-'}</span>
    }
    return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v || '-'}</span>
  }

  const field = (key: AddressKey, label: string) => (
    <FieldRow key={key} label={label} required={isReq(key)} errorText={errors[key] ? t('common:required') : undefined}>
      {editing ? renderInput(key) : renderValue(key)}
    </FieldRow>
  )

  // Address: read = one composed comma line; edit = the structured fields (always
  // saved structured — no backend change).
  const addressRow = () => {
    if (editing) return (
      <>
        {field('street', t('profile.street'))}
        {field('houseNumber', t('profile.houseNumber'))}
        {field('houseNumberSuffix', t('profile.houseNumberSuffix'))}
        {field('postalCode', t('profile.postalCode'))}
        {field('city', t('profile.city'))}
      </>
    )
    const line = [
      [c.street, [c.houseNumber, c.houseNumberSuffix].filter(Boolean).join('-')].filter(Boolean).join(' '),
      [c.postalCode, c.city].filter(Boolean).join(' '),
    ].filter(s => s && s.trim()).join(', ')
    return (
      <FieldRow label={t('profile.address')}>
        <span style={{ fontSize: 12, color: line ? 'var(--text)' : 'var(--text-muted)' }}>{line || '-'}</span>
      </FieldRow>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 }}>
        <EditControls editing={editing} onSave={save} onCancel={cancel} onStart={() => setEditing(true)} />
      </div>
      <GroupCard>
        {addressRow()}
        {field('province', t('profile.province'))}
        {field('country', t('profile.country'))}
      </GroupCard>
    </div>
  )
}
