import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2 } from 'lucide-react'
import DatePicker from 'react-datepicker'
import { NL_PROVINCES } from './constants'
import { SaveCancel } from '../../../components/forms/fields'

function LinkedinIcon({ size = 12, color = '#0A66C2' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  )
}

const NATIONALITIES = ['Nederlands','Belgisch','Duits','Frans','Brits','Pools','Turks','Marokkaans','Surinaams','Antilliaans','Overig']

/** Editable profile fields. `editing` is controlled by the drawer (the header
 * Edit button switches here), so name + fields toggle together. */
export default function ProfileTab({ c, editing, onEditSave, onEditCancel, onStartEdit }) {
  const { t } = useTranslation('candidates')
  const [form, setForm] = useState({ gender: c.gender ?? '', nationality: c.nationality ?? '', dob: c.dob ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', province: c.province ?? '', linkedin: c.linkedin ?? '', summary: c.summary ?? '' })
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }

  return (
    <div>
      {/* Profile fields */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16, position: 'relative' }}>
        {!editing && (
          <button onClick={onStartEdit}
            style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, display: 'flex', zIndex: 1 }}
            title={t('common:edit')}>
            <Edit2 size={13} />
          </button>
        )}
        {[
          [t('profile.gender'),      'gender'],
          [t('profile.nationality'), 'nationality'],
          [t('profile.dob'),         'dob'],
          [t('profile.email'),       'email'],
          [t('profile.phone'),       'phone'],
          [t('profile.address'),     'address'],
          [t('profile.province'),    'province'],
          [t('profile.linkedin'),    'linkedin'],
        ].map(([label, key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              {key === 'linkedin' && <LinkedinIcon size={12} color="#0A66C2" />}
              {label}
            </span>
            {editing ? (
              key === 'gender' ? (
                <select value={form.gender} onChange={e => setF('gender', e.target.value)} style={inputStyle}>
                  <option value="">{t('common:select')}</option>
                  <option value="man">{t('modal.gender.male')}</option>
                  <option value="vrouw">{t('modal.gender.female')}</option>
                  <option value="anders">{t('modal.gender.other')}</option>
                </select>
              ) : key === 'nationality' ? (
                <select value={form.nationality} onChange={e => setF('nationality', e.target.value)} style={inputStyle}>
                  <option value="">{t('common:select')}</option>
                  {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : key === 'province' ? (
                <select value={form.province} onChange={e => setF('province', e.target.value)} style={inputStyle}>
                  <option value="">{t('common:select')}</option>
                  {NL_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : key === 'dob' ? (
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
              ) : (
                <input value={form[key]} onChange={e => setF(key, e.target.value)} style={inputStyle}
                  placeholder={key === 'linkedin' ? 'https://linkedin.com/in/...' : undefined} />
              )
            ) : key === 'linkedin' ? (
              c[key]
                ? <a href={c[key].startsWith('http') ? c[key] : `https://${c[key]}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#0A66C2', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                    {c[key].replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{c[key] || '-'}</span>
            )}
          </div>
        ))}
        <div style={{ padding: '9px 12px', background: 'var(--surface)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('profile.summary')}</span>
          {editing
            ? <textarea value={form.summary} onChange={e => setF('summary', e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} />
            : <span style={{ fontSize: 12, color: 'var(--text)' }}>{c.summary || '-'}</span>
          }
        </div>
      </div>
      {editing && (
        <SaveCancel onSave={() => onEditSave(form)} onCancel={onEditCancel} />
      )}
    </div>
  )
}
