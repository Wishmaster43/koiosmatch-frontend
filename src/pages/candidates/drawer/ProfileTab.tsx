import { useState } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2, Cake } from 'lucide-react'
import DatePicker from 'react-datepicker'
import { NL_PROVINCES } from './constants'
import { useDateFormat, calcAge, daysUntilBirthday } from '@/lib/datetime'
import { useGenders } from '@/lib/useGenders'
import { useNationalities } from '@/lib/useNationalities'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import CustomFieldsSection from './CustomFieldsSection'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helpers — accept any props at the boundary.
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

// The editable profile fields — all string-valued and present on Candidate.
type ProfileKey = 'gender' | 'nationality' | 'dob' | 'placeOfBirth' | 'email' | 'phone'
  | 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city' | 'province' | 'linkedin'
type ProfileForm = Record<ProfileKey, string>

function LinkedinIcon({ size = 12, color = '#0A66C2' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}

/** Profile fields (grouped: personal / contact / address) + profile text, each
 * with its own in-place edit controls (pencil → save/cancel) above the block.
 * Fields use label-above layout (consistent with the rest of the app) and pair
 * short fields into two columns to keep the panel calm and scannable. */
export default function ProfileTab({ c, onEditSave, autoEditSignal }: { c: Candidate; onEditSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Gender + nationality come from tenant lookups (CFG-1), not hardcoded lists.
  const { genders } = useGenders()
  const { nationalities } = useNationalities()
  const emptyForm = (): ProfileForm => ({
    gender: c.gender ?? '', nationality: c.nationality ?? '', dob: c.dob ?? '', placeOfBirth: c.placeOfBirth ?? '',
    email: c.email ?? '', phone: c.phone ?? '',
    street: c.street ?? '', houseNumber: c.houseNumber ?? '', houseNumberSuffix: c.houseNumberSuffix ?? '',
    postalCode: c.postalCode ?? '', city: c.city ?? '', province: c.province ?? '',
    linkedin: c.linkedin ?? '',
  })
  const [editing,        setEditing]        = useState(false)
  // Open edit mode when the parent bumps the signal (e.g. right after Lead→Kandidaat convert).
  const [prevAutoEdit,   setPrevAutoEdit]   = useState(autoEditSignal ?? 0)
  if ((autoEditSignal ?? 0) !== prevAutoEdit) { setPrevAutoEdit(autoEditSignal ?? 0); setEditing(true) }
  const [summaryEditing, setSummaryEditing] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [form,    setForm]    = useState<ProfileForm>(emptyForm)
  const [summary, setSummary] = useState(c.summary ?? '')
  const [errors,  setErrors]  = useState<Partial<Record<ProfileKey, boolean>>>({})
  const setF = (k: ProfileKey, v: string) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  // Required fields for this candidate's phase (Settings → Verplichte velden). Only
  // the profile-owned fields are enforced here (name/function live in the header).
  const settings = useAllSettings()
  const requiredCfg = getJsonSetting<Record<string, string[]>>(settings, 'candidate_required_fields',
    { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'email', 'phone', 'function_title'] })
  const PROFILE_REQ_MAP: Partial<Record<ProfileKey, string>> = {
    email: 'email', phone: 'phone', gender: 'gender', dob: 'date_of_birth',
    street: 'street', postalCode: 'postal_code', city: 'city',
  }
  const requiredKeys = (requiredCfg[c.phase] ?? []) as string[]
  const isReq = (key: ProfileKey) => { const bk = PROFILE_REQ_MAP[key]; return !!bk && requiredKeys.includes(bk) }

  // Block save when a profile-owned required field is empty; flag the offenders.
  const saveFields   = () => {
    const e: Partial<Record<ProfileKey, boolean>> = {}
    ;(Object.keys(PROFILE_REQ_MAP) as ProfileKey[]).forEach(k => { if (isReq(k) && !String(form[k] ?? '').trim()) e[k] = true })
    if (Object.keys(e).length) { setErrors(e); return }
    onEditSave?.(form); setEditing(false); setErrors({})
  }
  const cancelFields = () => { setForm(emptyForm()); setErrors({}); setEditing(false) }
  const saveSummary   = () => { onEditSave?.({ summary }); setSummaryEditing(false) }
  const cancelSummary = () => { setSummary(c.summary ?? ''); setSummaryEditing(false) }

  const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

  // Render fn (not a nested component) so the field inputs keep focus.
  const editControls = (isEditing: boolean, onSave: () => void, onCancel: () => void, onStart: () => void) => isEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={onSave} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
        <Save size={13} />
      </button>
      <button onClick={onCancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        <X size={13} />
      </button>
    </div>
  ) : (
    <button onClick={onStart} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      <Edit2 size={13} />
    </button>
  )

  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

  // The edit input for one field — selects / date picker / plain text.
  const renderInput = (key: ProfileKey) => {
    if (key === 'gender') return (
      <select value={form.gender} onChange={e => setF('gender', e.target.value)} style={inputStyle}>
        <option value="">{t('common:select')}</option>
        {genders.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>
    )
    if (key === 'nationality') return (
      <select value={form.nationality} onChange={e => setF('nationality', e.target.value)} style={inputStyle}>
        <option value="">{t('common:select')}</option>
        {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    )
    if (key === 'province') return (
      <select value={form.province} onChange={e => setF('province', e.target.value)} style={inputStyle}>
        <option value="">{t('common:select')}</option>
        {NL_PROVINCES.map((p: string) => <option key={p} value={p}>{p}</option>)}
      </select>
    )
    if (key === 'dob') return (
      <DatePicker
        selected={(() => { try { const d = form.dob ? new Date(form.dob) : null; return d && !isNaN(d.getTime()) ? d : null } catch { return null } })()}
        onChange={(d: Date | null) => setF('dob', d ? d.toISOString().slice(0,10) : '')}
        dateFormat="dd-MM-yyyy"
        showMonthDropdown showYearDropdown dropdownMode="select"
        placeholderText={t('profile.selectDate')}
        portalId="datepicker-portal"
        popperPlacement="bottom-start"
        customInput={<input style={inputStyle} />}
      />
    )
    return (
      <input value={form[key]} onChange={e => setF(key, e.target.value)} style={inputStyle}
        placeholder={key === 'linkedin' ? 'https://linkedin.com/in/...' : undefined} />
    )
  }

  // The read-only value for one field — contact fields render as actionable links.
  const renderValue = (key: ProfileKey) => {
    const v = c[key]
    // Birthdate renders as DD-MM-YYYY + age; a soft cake chip flags an imminent
    // birthday (today / tomorrow / within two weeks) so recruiters can act on it.
    if (key === 'dob') {
      if (!v || v === '-') return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
      const age  = calcAge(v)
      const days = daysUntilBirthday(v)
      // days is null for unparseable dates; ≥2 keeps "dagen" plural-correct (0/1 handled apart).
      const bday = days == null ? null
        : days === 0 ? t('profile.birthdayToday')
        : days === 1 ? t('profile.birthdayTomorrow')
        : days <= 14 ? t('profile.birthdaySoon', { count: days })
        : null
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text)' }}>
          {formatDate(v)}
          {age != null && <span style={{ color: 'var(--text-muted)' }}>· {t('profile.age', { count: age })}</span>}
          {bday && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              padding: '2px 8px', borderRadius: 99, background: 'var(--color-primary-bg)',
              color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
              <Cake size={11} /> {bday}
            </span>
          )}
        </span>
      )
    }
    if (key === 'linkedin') {
      return v
        ? <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#0A66C2', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
            {v.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
    }
    if (key === 'email' && v) return <a href={`mailto:${v}`} style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}>{v}</a>
    if (key === 'phone' && v) return <a href={`tel:${String(v).replace(/\s/g, '')}`} style={{ fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}>{v}</a>
    // Gender stores a slug/label; resolve the display label from the /genders lookup.
    if (key === 'gender') {
      const label = genders.find(g => g.value === v || g.label === v)?.label ?? v
      return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{label || '-'}</span>
    }
    return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v || '-'}</span>
  }

  // One labelled field (label above value); swaps to an input while editing.
  // Label-left, value-right on one line (compact, like the preferences table).
  const field = (key: ProfileKey, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        {key === 'linkedin' && <LinkedinIcon size={12} color="#0A66C2" />}
        {label}{isReq(key) && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? renderInput(key) : renderValue(key)}
        {errors[key] && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('common:required')}</div>}
      </div>
    </div>
  )

  // Address: read = one composed comma line; edit = the structured fields (always
  // saved structured — no backend change). Province stays its own row below.
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{t('profile.address')}</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: line ? 'var(--text)' : 'var(--text-muted)' }}>{line || '-'}</div>
      </div>
    )
  }

  // A titled group card holding a column of fields.
  const card = (title: string, children: ReactNode) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }}>{title}</div>
      <div style={{ ...blockStyle, padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Profile fields, grouped (one edit toggle for all fields) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('drawer.tabs.profile')}</span>
          {editControls(editing, saveFields, cancelFields, () => setEditing(true))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {card(t('profile.groupPersonal'), <>
            {field('gender', t('profile.gender'))}
            {field('nationality', t('profile.nationality'))}
            {field('dob', t('profile.dob'))}
            {field('placeOfBirth', t('profile.placeOfBirth'))}
            {addressRow()}
            {field('province', t('profile.province'))}
          </>)}
          {card(t('profile.groupContact'), <>
            {field('email', t('profile.email'))}
            {field('phone', t('profile.phone'))}
            {field('linkedin', t('profile.linkedin'))}
          </>)}
        </div>
      </div>

      {/* ── Profile text — same rich editor as Notes (formatting + HTML toggle + expand) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('profile.summary')}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* Clear the profile text (edit mode only). */}
            {summaryEditing && (
              <button onClick={() => setSummary('')} title={t('profile.clear')} aria-label={t('profile.clear')}
                style={{ ...iconBtn, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--border)' }}>
                <Trash2 size={13} />
              </button>
            )}
            {editControls(summaryEditing, saveSummary, cancelSummary, () => setSummaryEditing(true))}
          </div>
        </div>
        {summaryEditing
          ? <RichTextEditor value={summary} onChange={setSummary}
              expanded={summaryExpanded} onToggleExpand={() => setSummaryExpanded(v => !v)} />
          : (c.summary
              ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
                  <SafeHtml html={c.summary} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
                </div>
              : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>-</div>)}
      </div>

      {/* Tenant custom fields — only renders when definitions exist */}
      <CustomFieldsSection c={c} onEditSave={onEditSave} />
    </div>
  )
}
