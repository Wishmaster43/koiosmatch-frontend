import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Cake } from 'lucide-react'
import DatePicker from 'react-datepicker'
import { useDateFormat, calcAge, daysUntilBirthday } from '@/lib/datetime'
import { toLocalIsoDate } from '@/lib/localDate'
import { useGenders } from '@/lib/useGenders'
import { useNationalities } from '@/lib/useNationalities'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import LookupIcon from '@/components/ui/LookupIcon'
import { FieldRow, EditControls, GroupCard, GroupHeader, inputStyle } from './profileFieldShared'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'
import SoftChip from '@/components/ui/SoftChip'

type AnyProps = Record<string, unknown>
// CreatableSelect is still untyped JS — accept any props at the boundary.
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

// The fields this sub-tab owns — split out of the old combined ProfileTab
// (Danny 28-07: one pencil flipping ~15 fields was unmaintainable).
// `source` briefly lived here and moved out again (Danny 09-08, "ik mis de bron"):
// buried between gender/nationality/birthdate it read as a property of the PERSON,
// while it describes the DOSSIER. It now sits with its own stamps in
// CandidateOriginCard ("Herkomst").
type PersonalKey = 'gender' | 'nationality' | 'dob' | 'placeOfBirth'
type PersonalForm = Record<PersonalKey, string>

// Only gender/dob are ever tenant-required among this tab's fields (mirrors
// the old PROFILE_REQ_MAP — nationality/placeOfBirth are never required).
const REQ_MAP: Partial<Record<PersonalKey, string>> = { gender: 'gender', dob: 'date_of_birth' }

/** Personal sub-tab — geslacht, nationaliteit, geboortedatum, geboorteplaats.
 *  Own pencil, own draft/error state; cancelling here never discards an
 *  in-progress edit in the Address or Contact sub-tab (each has its own). */
export default function ProfilePersonalTab({ c, onSave, autoEditSignal }: {
  c: Candidate; onSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number
}) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Gender + nationality come from tenant lookups (CFG-1), never hardcoded lists.
  const { genders } = useGenders()
  // LOOKUP-ICON-1 (decision 22-30-vlaggen "emoji passthrough"): `flags` maps a
  // nationality name to its ISO-2 flag emoji (derived from country_code) — fed to
  // the shared LookupIcon, which renders emoji/free-text as-is.
  const { nationalities, flags } = useNationalities()
  const requiredKeys = useProfileRequiredKeys(c.phase)
  const isReq = (key: PersonalKey) => { const bk = REQ_MAP[key]; return !!bk && requiredKeys.includes(bk) }

  const emptyForm = (): PersonalForm => ({
    gender: c.gender ?? '', nationality: c.nationality ?? '', dob: c.dob ?? '', placeOfBirth: c.placeOfBirth ?? '',
  })
  const [editing, setEditing] = useState(false)
  // Open edit mode when the parent bumps the signal (e.g. right after Lead→Kandidaat convert).
  const [prevAutoEdit, setPrevAutoEdit] = useState(autoEditSignal ?? 0)
  if ((autoEditSignal ?? 0) !== prevAutoEdit) { setPrevAutoEdit(autoEditSignal ?? 0); setEditing(true) }
  const [form, setForm] = useState<PersonalForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<PersonalKey, boolean>>>({})
  const setF = (k: PersonalKey, v: string) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  // Block save when a required field of THIS tab is empty; flag the offenders.
  const save = () => {
    const e: Partial<Record<PersonalKey, boolean>> = {}
    ;(Object.keys(REQ_MAP) as PersonalKey[]).forEach(k => { if (isReq(k) && !String(form[k] ?? '').trim()) e[k] = true })
    if (Object.keys(e).length) { setErrors(e); return }
    onSave?.(form); setEditing(false); setErrors({})
  }
  const cancel = () => { setForm(emptyForm()); setErrors({}); setEditing(false) }

  // Gender/nationality are pick-only (allowCreate=false) type-to-filter dropdowns
  // over their tenant lookups — never a plain <select> (Danny kandidaten-ronde-2,
  // punt A): easier to find a long lookup list by typing than by scrolling.
  const renderInput = (key: PersonalKey) => {
    if (key === 'gender') return (
      <CreatableSelect value={form.gender || null} onChange={(v: string) => setF('gender', v)} allowCreate={false}
        placeholder={t('common:select')} style={inputStyle}
        options={genders.map(g => ({ value: g.value, label: g.label }))} />
    )
    if (key === 'nationality') return (
      <CreatableSelect value={form.nationality || null} onChange={(v: string) => setF('nationality', v)} allowCreate={false}
        placeholder={t('common:select')} style={inputStyle}
        options={nationalities.map(n => ({ value: n, label: flags[n] ? `${flags[n]} ${n}` : n }))} />
    )
    if (key === 'dob') return (
      <DatePicker
        selected={(() => { try { const d = form.dob ? new Date(form.dob) : null; return d && !isNaN(d.getTime()) ? d : null } catch { return null } })()}
        // Local calendar day, never `.toISOString()` — a birthdate off by a day is a wrong age.
        onChange={(d: Date | null) => setF('dob', d ? toLocalIsoDate(d) : '')}
        dateFormat="dd-MM-yyyy"
        showMonthDropdown showYearDropdown dropdownMode="select"
        placeholderText={t('profile.selectDate')}
        portalId="datepicker-portal"
        popperPlacement="bottom-start"
        customInput={<input style={inputStyle} />}
      />
    )
    return <input value={form[key]} onChange={e => setF(key, e.target.value)} style={inputStyle} />
  }

  // Birthdate renders as DD-MM-YYYY + age; a soft cake chip flags an imminent
  // birthday (today / tomorrow / within two weeks) so recruiters can act on it.
  const renderValue = (key: PersonalKey) => {
    const v = c[key]
    if (key === 'dob') {
      if (!v || v === '-') return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
      const age  = calcAge(v)
      const days = daysUntilBirthday(v)
      const bday = days == null ? null
        : days === 0 ? t('profile.birthdayToday')
        : days === 1 ? t('profile.birthdayTomorrow')
        : days <= 14 ? t('profile.birthdaySoon', { count: days })
        : null
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text)' }}>
          {formatDate(v)}
          {age != null && <span style={{ color: 'var(--text-muted)' }}>· {t('profile.age', { count: age })}</span>}
          {/* Informational signal → the ONE SoftChip (Danny 20-08 asked; ruling:
              information stays tinted, actions wear the trio). */}
          {bday && (
            <SoftChip round label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Cake size={11} /> {bday}</span>} />
          )}
        </span>
      )
    }
    // Gender stores a slug/label; resolve the display label from the /genders lookup.
    if (key === 'gender') {
      const label = genders.find(g => g.value === v || g.label === v)?.label ?? v
      return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{label || '-'}</span>
    }
    // Nationality reads with its flag emoji in front (LookupIcon's emoji passthrough) —
    // absent for a nationality with no country_code, so the plain name still shows.
    if (key === 'nationality') {
      const flag = v ? flags[String(v)] : null
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>
          {flag && <LookupIcon icon={flag} size={13} />}
          {v || '-'}
        </span>
      )
    }
    return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v || '-'}</span>
  }

  const field = (key: PersonalKey, label: string) => (
    <FieldRow key={key} label={label} required={isReq(key)} errorText={errors[key] ? t('common:required') : undefined}>
      {editing ? renderInput(key) : renderValue(key)}
    </FieldRow>
  )

  return (
    <div>
      <GroupHeader title={t('profile.groupPersonal')}>
        <EditControls editing={editing} onSave={save} onCancel={cancel} onStart={() => setEditing(true)} />
      </GroupHeader>
      <GroupCard>
        {field('gender', t('profile.gender'))}
        {field('nationality', t('profile.nationality'))}
        {field('dob', t('profile.dob'))}
        {field('placeOfBirth', t('profile.placeOfBirth'))}
      </GroupCard>
    </div>
  )
}
