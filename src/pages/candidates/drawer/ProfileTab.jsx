import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import DatePicker from 'react-datepicker'
import { NL_PROVINCES } from './constants'

function LinkedinIcon({ size = 12, color = '#0A66C2' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}

const NATIONALITIES = ['Nederlands','Belgisch','Duits','Frans','Brits','Pools','Turks','Marokkaans','Surinaams','Antilliaans','Overig']

/** Profile fields (grouped: personal / contact / address) + profile text, each
 * with its own in-place edit controls (pencil → save/cancel) above the block.
 * Fields use label-above layout (consistent with the rest of the app) and pair
 * short fields into two columns to keep the panel calm and scannable. */
export default function ProfileTab({ c, onEditSave }) {
  const { t } = useTranslation('candidates')
  const emptyForm = () => ({
    gender: c.gender ?? '', nationality: c.nationality ?? '', dob: c.dob ?? '',
    email: c.email ?? '', phone: c.phone ?? '',
    street: c.street ?? '', houseNumber: c.houseNumber ?? '', houseNumberSuffix: c.houseNumberSuffix ?? '',
    postalCode: c.postalCode ?? '', city: c.city ?? '', province: c.province ?? '',
    linkedin: c.linkedin ?? '',
  })
  const [editing,        setEditing]        = useState(false)
  const [summaryEditing, setSummaryEditing] = useState(false)
  const [form,    setForm]    = useState(emptyForm)
  const [summary, setSummary] = useState(c.summary ?? '')
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const saveFields   = () => { onEditSave?.(form); setEditing(false) }
  const cancelFields = () => { setForm(emptyForm()); setEditing(false) }
  const saveSummary   = () => { onEditSave?.({ summary }); setSummaryEditing(false) }
  const cancelSummary = () => { setSummary(c.summary ?? ''); setSummaryEditing(false) }

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
  const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

  // Render fn (not a nested component) so the field inputs keep focus.
  const editControls = (isEditing, onSave, onCancel, onStart) => isEditing ? (
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

  const blockStyle = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

  // The edit input for one field — selects / date picker / plain text.
  const renderInput = (key) => {
    if (key === 'gender') return (
      <select value={form.gender} onChange={e => setF('gender', e.target.value)} style={inputStyle}>
        <option value="">{t('common:select')}</option>
        <option value="male">{t('modal.gender.male')}</option>
        <option value="female">{t('modal.gender.female')}</option>
        <option value="other">{t('modal.gender.other')}</option>
      </select>
    )
    if (key === 'nationality') return (
      <select value={form.nationality} onChange={e => setF('nationality', e.target.value)} style={inputStyle}>
        <option value="">{t('common:select')}</option>
        {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    )
    if (key === 'province') return (
      <select value={form.province} onChange={e => setF('province', e.target.value)} style={inputStyle}>
        <option value="">{t('common:select')}</option>
        {NL_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    )
    if (key === 'dob') return (
      <DatePicker
        selected={(() => { try { const d = form.dob ? new Date(form.dob) : null; return d && !isNaN(d) ? d : null } catch { return null } })()}
        onChange={d => setF('dob', d ? d.toISOString().slice(0,10) : '')}
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
  const renderValue = (key) => {
    const v = c[key]
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
    return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v || '-'}</span>
  }

  // One labelled field (label above value); swaps to an input while editing.
  const field = (key, label) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
        {key === 'linkedin' && <LinkedinIcon size={12} color="#0A66C2" />}
        {label}
      </div>
      {editing ? renderInput(key) : renderValue(key)}
    </div>
  )

  // Two short fields on one row.
  const pair = (a, b) => <div style={{ display: 'flex', gap: 12 }}>{a}{b}</div>

  // A titled group card holding a column of fields.
  const card = (title, children) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>{title}</div>
      <div style={{ ...blockStyle, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Profile fields, grouped (one edit toggle for all fields) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('drawer.tabs.profile')}</span>
          {editControls(editing, saveFields, cancelFields, () => setEditing(true))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {card(t('profile.groupPersonal'), <>
            {pair(field('gender', t('profile.gender')), field('nationality', t('profile.nationality')))}
            {field('dob', t('profile.dob'))}
          </>)}
          {card(t('profile.groupContact'), <>
            {field('email', t('profile.email'))}
            {field('phone', t('profile.phone'))}
            {field('linkedin', t('profile.linkedin'))}
          </>)}
          {card(t('profile.groupAddress'), <>
            {field('street', t('profile.street'))}
            {pair(field('houseNumber', t('profile.houseNumber')), field('houseNumberSuffix', t('profile.houseNumberSuffix')))}
            {pair(field('postalCode', t('profile.postalCode')), field('city', t('profile.city')))}
            {field('province', t('profile.province'))}
          </>)}
        </div>
      </div>

      {/* ── Profile text (edited separately) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('profile.summary')}</span>
          {editControls(summaryEditing, saveSummary, cancelSummary, () => setSummaryEditing(true))}
        </div>
        <div style={{ ...blockStyle, padding: '10px 12px' }}>
          {summaryEditing
            ? <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            : <span style={{ fontSize: 12, color: 'var(--text)' }}>{c.summary || '-'}</span>}
        </div>
      </div>
    </div>
  )
}
