import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Maximize2, Minimize2, Edit2, Plus, FileText, ChevronDown, ChevronUp, MoreHorizontal, GripVertical, Search, Check, Calendar, Eye, Pencil, Camera, Bold, Italic, List, ListOrdered, Heading2, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, Download, MapPin, Clock, Sparkles, RefreshCw, Heart } from 'lucide-react'
import api from '../../lib/api'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import 'react-datepicker/dist/react-datepicker.css'
import DatePicker from 'react-datepicker'

const DOC_TYPES = ['CV', 'ID-bewijs', 'Diploma', 'Contract', 'VOG', 'Certificaat', 'Overig']

const DOC_COLORS = {
  'CV':        '#3B82F6',
  'ID-bewijs': '#8B5CF6',
  'Diploma':   '#F59E0B',
  'Contract':  '#059669',
  'VOG':       '#EF4444',
  'Certificaat':'#EC4899',
  'Overig':    '#6B7280',
}

function isImage(name = '') { return /\.(png|jpe?g|gif|webp|svg)$/i.test(name) }
function isPdf(name = '')   { return /\.pdf$/i.test(name) }

function DocPreviewModal({ doc, onClose }) {
  if (!doc) return null
  const url = doc.objectUrl ?? doc.url
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', maxWidth: 800, width: '100%',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: DOC_COLORS[doc.type] ?? '#6B7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={13} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name ?? doc.file_name}</div>
            {doc.type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.type}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        {/* Preview */}
        <div style={{ flex: 1, overflow: 'auto', background: '#F3F4F6', minHeight: 400 }}>
          {!url ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Geen preview beschikbaar voor dit bestand.
            </div>
          ) : isImage(doc.name) ? (
            <img src={url} alt={doc.name} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
          ) : isPdf(doc.name) ? (
            <iframe src={url} title={doc.name} style={{ width: '100%', height: 600, border: 'none' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 13 }}>
              Preview niet beschikbaar. <a href={url} download={doc.name} style={{ marginLeft: 6, color: 'var(--color-primary)' }}>Downloaden</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const CANDIDATE_STATUSES = ['actief', 'nietactief', 'intake', 'verwijderd', 'extern']

// ── UI helpers ────────────────────────────────────────────────────────────────
export function Avatar({ initials, size = 28, photo }) {
  const colors = ['#6366F1','#3B82F6','#22C55E','#F59E0B','#EF4444','#8B5CF6','#EC4899']
  const color  = colors[(initials ?? '?').charCodeAt(0) % colors.length]
  return photo
    ? <img src={photo} alt={initials} style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', display: 'block' }} />
    : (
      <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: size * 0.36, fontWeight: 700 }}>
        {initials}
      </div>
    )
}

export function StatusBadge({ label, color }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
      background: (color ?? '#9CA3AF') + '20', color: color ?? '#9CA3AF' }}>
      {label}
    </span>
  )
}

export function Tag({ label }) {
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99,
      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', padding: '9px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{value || '-'}</span>
    </div>
  )
}

function SaveCancel({ onSave, onCancel }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <button onClick={onSave}
        style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
          background: 'var(--text)', color: '#fff', border: 'none', cursor: 'pointer' }}>
        Wijzigingen opslaan
      </button>
      <button onClick={onCancel}
        style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8,
          background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
        Annuleren
      </button>
    </div>
  )
}

function InlineInput({ placeholder, value, onChange, type = 'text' }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
        boxSizing: 'border-box', outline: 'none' }} />
  )
}

// ── Tab contents ──────────────────────────────────────────────────────────────
function ProfielTab({ c, editing, onEditSave, onEditCancel, onStartEdit }) {
  const [form, setForm] = useState({ gender: c.gender ?? '', nationality: c.nationality ?? '', dob: c.dob ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', summary: c.summary ?? '' })
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
            title="Bewerken">
            <Edit2 size={13} />
          </button>
        )}
        {[
          ['Geslacht',      'gender'],
          ['Nationaliteit', 'nationality'],
          ['Geboortedatum', 'dob'],
          ['E-mailadres',   'email'],
          ['Telefoon',      'phone'],
          ['Adres',         'address'],
        ].map(([label, key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
            {editing ? (
              key === 'gender' ? (
                <select value={form.gender} onChange={e => setF('gender', e.target.value)} style={inputStyle}>
                  <option value="">Selecteer</option>
                  <option value="man">Man</option>
                  <option value="vrouw">Vrouw</option>
                  <option value="anders">Anders / niet opgegeven</option>
                </select>
              ) : key === 'nationality' ? (
                <select value={form.nationality} onChange={e => setF('nationality', e.target.value)} style={inputStyle}>
                  <option value="">Selecteer</option>
                  {['Nederlands','Belgisch','Duits','Frans','Brits','Pools','Turks','Marokkaans','Surinaams','Antilliaans','Overig'].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : key === 'dob' ? (
                <DatePicker
                  selected={(() => { try { const d = form.dob ? new Date(form.dob) : null; return d && !isNaN(d) ? d : null } catch { return null } })()}
                  onChange={d => setF('dob', d ? d.toISOString().slice(0,10) : '')}
                  dateFormat="dd-MM-yyyy"
                  showMonthDropdown showYearDropdown dropdownMode="select"
                  placeholderText="Selecteer een datum"
                  portalId="datepicker-portal"
                  popperPlacement="bottom-start"
                  customInput={<input style={inputStyle} />}
                />
              ) : (
                <input value={form[key]} onChange={e => setF(key, e.target.value)} style={inputStyle} />
              )
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{c[key] || '-'}</span>
            )}
          </div>
        ))}
        <div style={{ padding: '9px 12px', background: 'var(--surface)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Samenvatting</span>
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

const dpInputStyle = { width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }

function FormDatePicker({ placeholder, value, onChange }) {
  const parsed = (() => { try { const d = value ? new Date(value) : null; return d && !isNaN(d) ? d : null } catch { return null } })()
  return (
    <DatePicker
      selected={parsed}
      onChange={d => onChange(d ? d.toISOString().slice(0,10) : '')}
      dateFormat="dd-MM-yyyy"
      showMonthDropdown showYearDropdown dropdownMode="select"
      placeholderText={placeholder}
      portalId="datepicker-portal"
      popperPlacement="bottom-start"
      customInput={<input style={dpInputStyle} />}
    />
  )
}

function AddForm({ fields, onSave, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])))
  const set = (k, v) => setValues(p => ({ ...p, [k]: v }))

  const renderSingleField = (f) => {
    if (f.textarea) return (
      <textarea key={f.key} placeholder={f.label} value={values[f.key]} onChange={e => set(f.key, e.target.value)} rows={3}
        style={{ width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />
    )
    if (f.date) return <FormDatePicker key={f.key} placeholder={f.label} value={values[f.key]} onChange={v => set(f.key, v)} />
    return <InlineInput key={f.key} placeholder={f.label} value={values[f.key]} onChange={v => set(f.key, v)} type={f.type} />
  }

  const renderFields = () => {
    const rows = []
    let i = 0
    while (i < fields.length) {
      const f = fields[i]
      if (f.half && fields[i+1]?.half) {
        rows.push(
          <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {f.date ? <FormDatePicker placeholder={f.label} value={values[f.key]} onChange={v => set(f.key, v)} /> : <InlineInput placeholder={f.label} value={values[f.key]} onChange={v => set(f.key, v)} type={f.type} />}
            {fields[i+1].date ? <FormDatePicker placeholder={fields[i+1].label} value={values[fields[i+1].key]} onChange={v => set(fields[i+1].key, v)} /> : <InlineInput placeholder={fields[i+1].label} value={values[fields[i+1].key]} onChange={v => set(fields[i+1].key, v)} type={fields[i+1].type} />}
          </div>
        )
        i += 2
      } else if (f.separator) {
        rows.push(
          <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            {f.date ? <FormDatePicker placeholder={f.label} value={values[f.key]} onChange={v => set(f.key, v)} /> : <InlineInput placeholder={f.label} value={values[f.key]} onChange={v => set(f.key, v)} type={f.type} />}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>tot</span>
            {fields[i+1].date ? <FormDatePicker placeholder={fields[i+1].label} value={values[fields[i+1].key]} onChange={v => set(fields[i+1].key, v)} /> : <InlineInput placeholder={fields[i+1].label} value={values[fields[i+1].key]} onChange={v => set(fields[i+1].key, v)} type={fields[i+1].type} />}
          </div>
        )
        i += 2
      } else {
        rows.push(renderSingleField(f))
        i++
      }
    }
    return rows
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px', marginBottom: 10, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {renderFields()}
      <SaveCancel onSave={() => onSave(values)} onCancel={onCancel} />
    </div>
  )
}

function ErvaringTab({ items = [], onAdd }) {
  const [adding, setAdding] = useState(false)
  const fields = [
    { key: 'title',    label: 'Functietitel' },
    { key: 'company',  label: 'Bedrijf' },
    { key: 'location', label: 'Locatie' },
    { key: 'start',    label: 'Begindatum', half: true, date: true },
    { key: 'end',      label: 'Einddatum',  half: true, date: true },
    { key: 'desc',     label: 'Omschrijving', textarea: true },
  ]

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionTitle}>Ervaring</span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> Toevoegen
          </button>
        )}
      </div>
      {adding && <AddForm fields={fields} onSave={v => { onAdd(v); setAdding(false) }} onCancel={() => setAdding(false)} />}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen ervaringen.</div>
      )}
      {items.map((e, i) => (
        <div key={e.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 5 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.title ?? e.function_title}</div>
            {(e.company ?? e.employer) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.company ?? e.employer}</div>}
            {e.location && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.location}</div>}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.period ?? [e.start_date, e.end_date].filter(Boolean).join(' – ')}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const sectionBlock = { border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)' }
const sectionTitle = { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }

function OpleidingTab({ items = [], onAdd }) {
  const [adding, setAdding] = useState(false)
  const fields = [
    { key: 'title',   label: 'Diploma' },
    { key: 'school',  label: 'Instelling' },
    { key: 'start',   label: 'Begindatum', half: true, date: true },
    { key: 'end',     label: 'Einddatum',  half: true, date: true },
    { key: 'desc',    label: 'Omschrijving', textarea: true },
    { key: 'issued',  label: 'Datum van uitgifte', date: true },
  ]

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionTitle}>Opleiding</span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> Toevoegen
          </button>
        )}
      </div>
      {adding && <AddForm fields={fields} onSave={v => { onAdd(v); setAdding(false) }} onCancel={() => setAdding(false)} />}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen opleidingen.</div>
      )}
      {items.map((o, i) => (
        <div key={o.id ?? i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: 5 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.title ?? o.education}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.school ?? o.institution}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.period ?? o.year}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TaalTab({ items = [], onAdd }) {
  const [adding, setAdding] = useState(false)
  const fields = [
    { key: 'taal',        label: 'Taal' },
    { key: 'mondeling',   label: 'Gesproken niveau' },
    { key: 'schriftelijk',label: 'Schriftelijk niveau' },
  ]

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionTitle}>Talen</span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> Toevoegen
          </button>
        )}
      </div>
      {adding && <AddForm fields={fields} onSave={v => { onAdd(v); setAdding(false) }} onCancel={() => setAdding(false)} />}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen talen.</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((t, i) => (
          <span key={t.id ?? i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99,
            border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
            {t.taal ?? t.language}{t.mondeling ? ` · ${t.mondeling}` : ''}{t.schriftelijk ? ` · ${t.schriftelijk}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function CertificeringenTab({ items = [], onAdd }) {
  const [adding, setAdding] = useState(false)
  const fields = [
    { key: 'name',    label: 'Certificeringnaam' },
    { key: 'org',     label: 'Organisatie' },
    { key: 'issued',  label: 'Datum van uitgifte', separator: true, date: true },
    { key: 'expires', label: 'Vervaldatum', date: true },
    { key: 'license', label: 'licentienummer' },
    { key: 'desc',    label: 'Omschrijving', textarea: true },
  ]

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionTitle}>Certificeringen</span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> Toevoegen
          </button>
        )}
      </div>
      {adding && <AddForm fields={fields} onSave={v => { onAdd(v); setAdding(false) }} onCancel={() => setAdding(false)} />}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen certificeringen.</div>
      )}
      {items.map((cert, i) => (
        <div key={cert.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cert.name ?? cert.title}</div>
            {cert.org && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cert.org}</div>}
            {(cert.issued || cert.expires) && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {cert.issued && `Uitgegeven: ${cert.issued}`}{cert.issued && cert.expires && ' · '}{cert.expires && `Verloopt: ${cert.expires}`}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function VaardighedenTab({ items = [], onAdd }) {
  const [adding, setAdding] = useState(false)
  const fields = [
    { key: 'name',  label: 'Vaardigheid' },
    { key: 'level', label: 'Vaardigheidsniveau' },
  ]

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionTitle}>Vaardigheden</span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
              color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> Toevoegen
          </button>
        )}
      </div>
      {adding && <AddForm fields={fields} onSave={v => { onAdd(v); setAdding(false) }} onCancel={() => setAdding(false)} />}
      {items.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen vaardigheden.</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((v, i) => (
          <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99,
            border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
            {typeof v === 'string' ? v : (v.name ?? v.skill)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Candidate Drawer ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'profiel',       label: 'Profiel'      },
  { id: 'achtergrond',   label: 'Achtergrond'  },
  { id: 'werk',          label: 'Werk'         },
  { id: 'planning',      label: 'Planning'     },
  { id: 'voorkeuren',    label: 'Voorkeuren'   },
  { id: 'administratie', label: 'ZZP'          },
  { id: 'communicatie',  label: 'Communicatie' },
  { id: 'statistieken',  label: 'Statistieken' },
]

function PlaatsingenTab({ c }) {
  const [plaatsingen, setPlaatsingen] = useState(c.plaatsingen ?? [])
  const [adding, setAdding] = useState(false)
  const EMPTY = { klant: '', functie: '', schaal: '', trede: '', uurloon: '', uren_per_week: '', periode_van: '', periode_tot: '', contractsoort: '', contractduur: '' }

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={sectionTitle}>Plaatsingen</span>
        {!adding && (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> Toevoegen
          </button>
        )}
      </div>
      {adding && (
        <AddForm
          fields={[
            { key: 'klant',         label: 'Klant' },
            { key: 'functie',       label: 'Functie' },
            { key: 'schaal',        label: 'Schaal',        half: true },
            { key: 'trede',         label: 'Trede',         half: true },
            { key: 'uurloon',       label: 'Uurloon (€)',   half: true },
            { key: 'uren_per_week', label: 'Uren p/w',      half: true },
            { key: 'periode_van',   label: 'Startdatum',    separator: true, date: true },
            { key: 'periode_tot',   label: 'Einddatum',     date: true },
            { key: 'contractsoort', label: 'Contractsoort', half: true },
            { key: 'contractduur',  label: 'Contractduur',  half: true },
          ]}
          onSave={v => { setPlaatsingen(p => [...p, v]); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}
      {plaatsingen.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen plaatsingen.</div>
      )}
      {plaatsingen.map((p, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.klant || '-'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {p.periode_van && p.periode_tot ? `${p.periode_van} t/m ${p.periode_tot}` : (p.periode_van ?? '')}
            </span>
          </div>
          {[
            ['Functie',       p.functie       || '-'],
            ['Schaal / Trede', p.schaal && p.trede ? `${p.schaal} / ${p.trede}` : (p.schaal || p.trede || '-')],
            ['Uurloon',       p.uurloon       ? `€ ${p.uurloon}` : '-'],
            ['Uren per week', p.uren_per_week || '-'],
            ['Contractsoort', p.contractsoort || '-'],
            ['Contractduur',  p.contractduur  || '-'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', padding: '7px 12px', borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function KoiosAiBlock({ c }) {
  const [loading, setLoading] = useState(false)

  const coreFields = [c.email, c.phone, c.dob, c.address, c.gender, c.nationality, c.summary]
  const filledPct  = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)

  const insights = [
    {
      type: 'Volledigheid',
      color: filledPct >= 80 ? '#16A34A' : '#D97706',
      text: filledPct >= 80
        ? 'Profiel is goed gevuld — geen ontbrekende kernvelden gedetecteerd.'
        : `Profiel is ${filledPct}% compleet. Voeg samenvatting, adres en geboortedatum toe voor betere matchresultaten.`,
    },
    {
      type: 'Functiematch',
      color: '#6366F1',
      text: 'Op basis van het profiel is de verwachte beste match: Verzorgende IG en Helpende Plus bij zorginstellingen in de regio.',
    },
    {
      type: 'Betrokkenheid',
      color: '#3B82F6',
      text: c.laatste_contact_datum
        ? `Laatste contactmoment geregistreerd op ${c.laatste_contact_datum}. Profiel is actief bewaakt.`
        : 'Geen recent contactmoment geregistreerd. Een follow-up verhoogt de kans op succesvolle plaatsing.',
    },
  ]

  return (
    <div style={{ border: '1px solid #C4B5FD', borderRadius: 10, padding: '14px 16px', background: 'linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={13} color="white" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5', flex: 1 }}>Koios AI adviseert</span>
        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#DDD6FE', color: '#6D28D9', fontWeight: 600 }}>Beta</span>
        <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1400) }}
          title="Vernieuwen" disabled={loading}
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: '#6366F1', padding: 3, display: 'flex', opacity: loading ? 0.4 : 1, borderRadius: 5 }}>
          <RefreshCw size={12} />
        </button>
      </div>
      {loading
        ? <div style={{ fontSize: 12, color: '#6366F1', fontStyle: 'italic' }}>Koios AI analyseert profiel…</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,0.55)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ins.color, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ins.color, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ins.type}</div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{ins.text}</div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

const AGENDA_DIENSTEN = [
  { date: '2026-06-16', start: 7,  end: 15, klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', color: '#3B82F6', locatie: 'Amsterdam', eerder_gewerkt: 4, adres: 'Amstelveenseweg 220' },
  { date: '2026-06-18', start: 13, end: 17, klant: 'Zorggroep West',   functie: 'Helpende Plus',  color: '#8B5CF6', locatie: 'Haarlem',   eerder_gewerkt: 0, adres: 'Kennemerplein 10'    },
  { date: '2026-06-19', start: 8,  end: 12, klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', color: '#3B82F6', locatie: 'Amsterdam', eerder_gewerkt: 4, adres: 'Amstelveenseweg 220' },
  { date: '2026-06-20', start: 10, end: 13, klant: 'Zorggroep Oost',   functie: 'Helpende',       color: '#22C55E', locatie: 'Utrecht',   eerder_gewerkt: 1, adres: 'Maliebaan 50'        },
  { date: '2026-06-23', start: 7,  end: 15, klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', color: '#3B82F6', locatie: 'Amsterdam', eerder_gewerkt: 4, adres: 'Amstelveenseweg 220' },
  { date: '2026-06-25', start: 14, end: 18, klant: 'Zorggroep West',   functie: 'Helpende Plus',  color: '#8B5CF6', locatie: 'Haarlem',   eerder_gewerkt: 0, adres: 'Kennemerplein 10'    },
  { date: '2026-06-26', start: 7,  end: 11, klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', color: '#3B82F6', locatie: 'Amsterdam', eerder_gewerkt: 4, adres: 'Amstelveenseweg 220' },
]

const DUMMY_DIENSTEN_LIST = [
  { datum: 'ma 16 jun', tijd: '07:00–15:00', klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', locatie: 'Amsterdam', color: '#3B82F6', eerder_gewerkt: 4, favoriet: true,  adres: 'Amstelveenseweg 220', opmerkingen: 'Vaste begeleider voor mevrouw De Vries.' },
  { datum: 'wo 18 jun', tijd: '13:00–17:00', klant: 'Zorggroep West',   functie: 'Helpende Plus',  locatie: 'Haarlem',   color: '#8B5CF6', eerder_gewerkt: 0, favoriet: false, adres: 'Kennemerplein 10',    opmerkingen: 'Eerste dienst bij deze klant.'          },
  { datum: 'do 19 jun', tijd: '08:00–12:00', klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', locatie: 'Amsterdam', color: '#3B82F6', eerder_gewerkt: 4, favoriet: true,  adres: 'Amstelveenseweg 220', opmerkingen: 'Ochtendrondes afdeling 3.'               },
  { datum: 'vr 20 jun', tijd: '10:00–13:00', klant: 'Zorggroep Oost',   functie: 'Helpende',       locatie: 'Utrecht',   color: '#22C55E', eerder_gewerkt: 1, favoriet: false, adres: 'Maliebaan 50',        opmerkingen: ''                                        },
  { datum: 'ma 23 jun', tijd: '07:00–15:00', klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', locatie: 'Amsterdam', color: '#3B82F6', eerder_gewerkt: 4, favoriet: true,  adres: 'Amstelveenseweg 220', opmerkingen: 'Vaste begeleider voor mevrouw De Vries.' },
  { datum: 'do 25 jun', tijd: '14:00–18:00', klant: 'Zorggroep West',   functie: 'Helpende Plus',  locatie: 'Haarlem',   color: '#8B5CF6', eerder_gewerkt: 0, favoriet: false, adres: 'Kennemerplein 10',    opmerkingen: ''                                        },
  { datum: 'vr 26 jun', tijd: '07:00–11:00', klant: 'Thuiszorg Noord',  functie: 'Verzorgende IG', locatie: 'Amsterdam', color: '#3B82F6', eerder_gewerkt: 4, favoriet: true,  adres: 'Amstelveenseweg 220', opmerkingen: 'Ochtendrondes afdeling 3.'               },
]

function DienstDetail({ s, onClose }) {
  const [fav, setFav] = useState(s.favoriet ?? false)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: s.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.klant}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.functie}</div>
        </div>
        <button onClick={() => setFav(f => !f)} title={fav ? 'Verwijder favoriet' : 'Markeer als favoriet'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: fav ? '#EF4444' : 'var(--text-muted)', display: 'flex' }}>
          <Heart size={15} fill={fav ? '#EF4444' : 'none'} />
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
      {[
        ['Tijdstip',       `${s.start ?? '?'}:00 – ${s.end ?? '?'}:00`],
        ['Locatie',        s.locatie ?? '-'],
        ['Adres',          s.adres   ?? '-'],
        ['Eerder gewerkt', s.eerder_gewerkt > 0 ? `Ja, ${s.eerder_gewerkt}× bij ${s.klant}` : `Nee, eerste keer bij ${s.klant}`],
      ].map(([l, v]) => (
        <div key={l} style={{ display: 'flex', padding: '8px 14px', borderBottom: '1px solid var(--border)', gap: 12, background: 'var(--surface)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{l}</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{v}</span>
        </div>
      ))}
      {s.eerder_gewerkt > 0 && (
        <div style={{ padding: '8px 14px', background: '#F0FDF4', borderTop: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={12} color="#16A34A" />
          <span style={{ fontSize: 11, color: '#15803D', fontWeight: 500 }}>Kandidaat is bekend bij deze klant</span>
        </div>
      )}
    </div>
  )
}

function BeschikbaarheidAgenda() {
  const [view,     setView]     = useState('maand')
  const [base,     setBase]     = useState(new Date(2026, 5, 16))
  const [selected, setSelected] = useState(null)

  const DAYS_NL   = ['ma','di','wo','do','vr','za','zo']
  const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
  const HOURS     = [7,8,9,10,11,12,13,14,15,16,17,18]

  const addDays    = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const addMonths_ = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r }
  const fmtD       = (d)    => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const getMon     = (d)    => { const r = new Date(d); const dw = r.getDay(); r.setDate(r.getDate() - (dw === 0 ? 6 : dw - 1)); r.setHours(0,0,0,0); return r }
  const getDOW     = (d)    => { const d0 = d.getDay(); return d0 === 0 ? 6 : d0 - 1 }

  const dienstenForDate = (d) => AGENDA_DIENSTEN.filter(s => s.date === fmtD(d))

  const nav = (n) => {
    setSelected(null)
    if (view === 'dag')   setBase(b => addDays(b, n))
    if (view === 'week')  setBase(b => addDays(b, n * 7))
    if (view === 'maand') setBase(b => addMonths_(b, n))
  }

  const navLabel = () => {
    if (view === 'maand') return `${MONTHS_NL[base.getMonth()].charAt(0).toUpperCase() + MONTHS_NL[base.getMonth()].slice(1)} ${base.getFullYear()}`
    if (view === 'week')  {
      const mon = getMon(base); const sun = addDays(mon, 6)
      if (mon.getMonth() === sun.getMonth())
        return `${mon.getDate()} – ${sun.getDate()} ${MONTHS_NL[mon.getMonth()]} ${mon.getFullYear()}`
      return `${mon.getDate()} ${MONTHS_NL[mon.getMonth()].slice(0,3)} – ${sun.getDate()} ${MONTHS_NL[sun.getMonth()].slice(0,3)} ${sun.getFullYear()}`
    }
    return `${base.getDate()} ${MONTHS_NL[base.getMonth()]} ${base.getFullYear()}`
  }

  const renderWeek = () => {
    const mon  = getMon(base)
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
    const today = new Date()
    const isToday = (d) => d.toDateString() === today.toDateString()
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          <div />
          {days.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '6px 2px', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{DAYS_NL[i]}</div>
              <div style={{ width: 24, height: 24, borderRadius: '50%', margin: '2px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isToday(d) ? 'var(--color-primary)' : 'transparent',
                fontSize: 13, fontWeight: 700, color: isToday(d) ? 'white' : i >= 5 ? 'var(--text-muted)' : 'var(--text)' }}>
                {d.getDate()}
              </div>
            </div>
          ))}
        </div>
        {HOURS.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: 32 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '6px 6px 0', textAlign: 'right', background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>{h}:00</div>
            {days.map((d, i) => {
              const ds = dienstenForDate(d).filter(s => h >= s.start && h < s.end)
              return (
                <div key={i} style={{ borderLeft: i > 0 ? '1px solid var(--border)' : 'none', background: i >= 5 ? '#FAFAFA' : 'transparent' }}>
                  {ds.map((s, j) => (
                    <div key={j} onClick={() => setSelected(s)}
                      style={{ background: selected === s ? s.color + '40' : s.color + '22', borderLeft: `3px solid ${s.color}`,
                        padding: '2px 4px', fontSize: 9, color: s.color, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: 1.4, cursor: 'pointer' }}>
                      {h === s.start ? s.klant : ''}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderMonth = () => {
    const year = base.getFullYear(), month = base.getMonth()
    const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0)
    const startDow = getDOW(firstDay)
    const cells = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const rows = []; for (let r = 0; r < cells.length / 7; r++) rows.push(cells.slice(r*7, r*7+7))
    const today = new Date()
    const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate()

    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
          {DAYS_NL.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', padding: '7px 4px', fontSize: 10, fontWeight: 700,
              color: i >= 5 ? '#9CA3AF' : 'var(--text-muted)', textTransform: 'uppercase',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>{d}</div>
          ))}
        </div>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {row.map((day, ci) => {
              const d = day ? new Date(year, month, day) : null
              const ds = d ? dienstenForDate(d) : []
              const tod = isToday(day)
              return (
                <div key={ci} style={{ minHeight: 68, padding: '4px', borderLeft: ci > 0 ? '1px solid var(--border)' : 'none',
                  background: ci >= 5 ? '#FAFAFA' : 'white' }}>
                  {day && (
                    <>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: tod ? 'var(--color-primary)' : 'transparent', marginBottom: 2,
                        fontSize: 11, fontWeight: tod ? 700 : 400, color: tod ? 'white' : ci >= 5 ? '#9CA3AF' : 'var(--text)' }}>
                        {day}
                      </div>
                      {ds.map((s, j) => (
                        <div key={j} onClick={() => setSelected(selected === s ? null : s)}
                          style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, marginBottom: 2, cursor: 'pointer',
                            background: selected === s ? s.color + '40' : s.color + '18',
                            color: s.color, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            borderLeft: `3px solid ${s.color}`, outline: selected === s ? `2px solid ${s.color}` : 'none' }}>
                          {s.start}:00–{s.end}:00 {s.klant}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderDay = () => {
    const ds = dienstenForDate(base)
    const today = new Date(); const isToday = base.toDateString() === today.toDateString()
    const dow = getDOW(base)
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'][dow]} {base.getDate()} {MONTHS_NL[base.getMonth()]}
          </span>
          {isToday && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: 'var(--color-primary)', color: 'white', fontWeight: 600 }}>Vandaag</span>}
          {ds.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Geen diensten</span>}
        </div>
        {HOURS.map((h, hi) => {
          const slot = ds.filter(s => h >= s.start && h < s.end)
          return (
            <div key={h} style={{ display: 'grid', gridTemplateColumns: '50px 1fr', borderBottom: hi < HOURS.length - 1 ? '1px solid var(--border)' : 'none', minHeight: 40 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 8px 0', textAlign: 'right', borderRight: '1px solid var(--border)', background: 'var(--bg)' }}>{h}:00</div>
              <div style={{ padding: slot.length ? '4px 10px' : 0 }}>
                {slot.map((s, j) => (
                  <div key={j} onClick={() => setSelected(selected === s ? null : s)}
                    style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 3, cursor: 'pointer',
                      background: selected === s ? s.color + '30' : s.color + '18',
                      borderLeft: `3px solid ${s.color}`, outline: selected === s ? `2px solid ${s.color}` : 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.klant}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.functie} · {s.start}:00–{s.end}:00</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const vBtn = (id) => ({
    padding: '4px 10px', fontSize: 11, fontWeight: view === id ? 600 : 400, borderRadius: 6, cursor: 'pointer',
    border: '1px solid ' + (view === id ? 'var(--color-primary)' : 'var(--border)'),
    background: view === id ? 'var(--color-primary)' : 'none',
    color: view === id ? 'white' : 'var(--text-muted)',
  })

  return (
    <div style={sectionBlock}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Beschikbaarheidsagenda</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['dag','Dag'],['week','Week'],['maand','Maand']].map(([id, lbl]) => (
            <button key={id} style={vBtn(id)} onClick={() => { setView(id); setSelected(null) }}>{lbl}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => nav(-1)} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, textAlign: 'center' }}>{navLabel()}</span>
        <button onClick={() => nav(1)}  style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>›</button>
      </div>
      {view === 'week'  && renderWeek()}
      {view === 'maand' && renderMonth()}
      {view === 'dag'   && renderDay()}
      {selected && <DienstDetail key={selected.date + selected.klant} s={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function VoorkeurenTab({ c }) {
  const pref = c.voorkeuren ?? c.preferences ?? {}
  const [form, setForm] = useState({
    beschikbaar_per:  pref.available_from   ?? '',
    uren_per_week:    pref.hours_per_week   ?? '',
    dagen:            pref.preferred_days   ?? '',
    reisafstand:      pref.max_travel_km    ?? '',
    reistijd:         pref.max_travel_min   ?? '',
    rijbewijs:        pref.has_license      ?? false,
    eigen_vervoer:    pref.own_transport    ?? false,
    functie:          pref.function_pref    ?? '',
    branche:          pref.sector_pref      ?? '',
    min_tarief:       pref.min_rate         ?? '',
    contract:         pref.contract_pref    ?? '',
    opmerkingen:      pref.remarks          ?? '',
  })
  const [editing, setEditing] = useState(false)
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const iStyle = { flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 6,
    border: '1px solid var(--border)', background: editing ? 'white' : 'var(--bg)',
    color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }

  const Row = ({ label, field, type = 'text' }) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '9px 12px',
      borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 160, flexShrink: 0 }}>{label}</span>
      {type === 'checkbox'
        ? <input type="checkbox" checked={!!form[field]} onChange={e => setF(field, e.target.checked)}
            disabled={!editing}
            style={{ width: 14, height: 14, accentColor: 'var(--color-primary)', cursor: editing ? 'pointer' : 'default' }} />
        : editing
          ? <input value={form[field]} onChange={e => setF(field, e.target.value)} style={iStyle} />
          : <span style={{ fontSize: 12, color: 'var(--text)' }}>{form[field] || '-'}</span>
      }
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Voorkeuren</span>
        {!editing && <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><Edit2 size={13} /></button>}
      </div>
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }}>
        <Row label="Beschikbaar per"     field="beschikbaar_per" />
        <Row label="Uren per week"       field="uren_per_week" />
        <Row label="Voorkeursdagen"      field="dagen" />
        <Row label="Max. reisafstand (km)" field="reisafstand" />
        <Row label="Max. reistijd (min)" field="reistijd" />
        <Row label="Rijbewijs"           field="rijbewijs"     type="checkbox" />
        <Row label="Eigen vervoer"       field="eigen_vervoer" type="checkbox" />
        <Row label="Voorkeursfunctie"    field="functie" />
        <Row label="Voorkeurs branche"   field="branche" />
        <Row label="Min. uurtarief (€)"  field="min_tarief" />
        <Row label="Contract voorkeur"   field="contract" />
        <Row label="Opmerkingen"         field="opmerkingen" />
      </div>
      {editing && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8, background: 'var(--text)', color: '#fff', border: 'none', cursor: 'pointer' }}>Opslaan</button>
          <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>Annuleren</button>
        </div>
      )}
    </div>
  )
}

const RIJBEWIJZEN = ['Rijbewijs B', 'Rijbewijs BE', 'Rijbewijs C', 'Rijbewijs CE', 'Rijbewijs D', 'Rijbewijs E']

const ALL_FUNCTIES = [
  'Doktersassistent', 'EVV\'er - UZK', 'EVV\'er - ZZP',
  'Helpende - UZK', 'Helpende - ZZP', 'Helpende Plus - UZK', 'Helpende Plus - ZZP',
  'Verpleegkundige Niveau 4 - UZK', 'Verpleegkundige Niveau 4 - ZZP',
  'Verpleegkundige Niveau 5 - UZK', 'Verpleegkundige Niveau 5 - ZZP',
  'Verzorgende IG - UZK', 'Verzorgende IG - ZZP',
]

const ALL_POOLS = [
  'Doktersassistent', 'EVV\'er', 'Helpende', 'Helpende Plus',
  'Verpleegkundige Niveau 4 MBO', 'Verpleegkundige Niveau 5 HBO', 'Verzorgende IG',
]

function PlanningTab({ c }) {
  const plan = c.planning_settings ?? {}
  const [info,         setInfo]        = useState(plan.info ?? '')
  const [functies,     setFuncties]    = useState(plan.functies ?? [])
  const [pools,        setPools]       = useState(plan.pools ?? [])
  const [diensttype,   setDiensttype]  = useState(plan.diensttype ?? [])
  const [rijbewijzen,  setRijbewijzen] = useState(plan.rijbewijzen ?? [])
  const [rijOpen,      setRijOpen]     = useState(false)
  const rijRef = useRef(null)

  useEffect(() => {
    const h = e => { if (rijRef.current && !rijRef.current.contains(e.target)) setRijOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const tog = (val, set) => set(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])

  const Chip = ({ label, selected, onToggle }) => (
    <button onClick={onToggle} style={{
      padding: '4px 11px', fontSize: 11, borderRadius: 99, cursor: 'pointer', transition: 'all 0.1s',
      border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}`,
      background: selected ? 'var(--color-primary)' : 'var(--bg)',
      color: selected ? '#fff' : 'var(--text-muted)', fontWeight: selected ? 600 : 400,
    }}>
      {label}
    </button>
  )

  const SecLabel = ({ children, action }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</span>
      {action}
    </div>
  )

  return (
    <div style={sectionBlock}>
      <span style={sectionTitle}>Functies, pools en skills</span>

      {/* Info */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel>Informatie bij planning</SecLabel>
        <input value={info} onChange={e => setInfo(e.target.value)} placeholder="Notitie voor planners…"
          style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Functies */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel action={
          <button onClick={() => setFuncties(f => f.length === ALL_FUNCTIES.length ? [] : [...ALL_FUNCTIES])}
            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {functies.length === ALL_FUNCTIES.length ? 'Alles deselecteren' : 'Alles selecteren'}
          </button>
        }>Globale functie</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_FUNCTIES.map(f => <Chip key={f} label={f} selected={functies.includes(f)} onToggle={() => tog(f, setFuncties)} />)}
        </div>
      </div>

      {/* Pools */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel action={
          <button onClick={() => setPools(p => p.length === ALL_POOLS.length ? [] : [...ALL_POOLS])}
            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {pools.length === ALL_POOLS.length ? 'Alles deselecteren' : 'Alles selecteren'}
          </button>
        }>Pools</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_POOLS.map(p => <Chip key={p} label={p} selected={pools.includes(p)} onToggle={() => tog(p, setPools)} />)}
        </div>
      </div>

      {/* Diensttype */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel>Voorkeur dienstype</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Avonddienst', 'Dagdienst', 'Nachtdienst'].map(d => (
            <Chip key={d} label={d} selected={diensttype.includes(d)} onToggle={() => tog(d, setDiensttype)} />
          ))}
        </div>
      </div>

      {/* Rijbewijzen */}
      <div>
        <SecLabel>Rijbewijzen</SecLabel>
        {rijbewijzen.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {rijbewijzen.map(r => (
              <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11,
                borderRadius: 99, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600 }}>
                {r}
                <button onClick={() => setRijbewijzen(p => p.filter(x => x !== r))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, lineHeight: 1, fontSize: 14, opacity: 0.7 }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div ref={rijRef} style={{ position: 'relative' }}>
          <button onClick={() => setRijOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, fontWeight: 500,
              border: '1px dashed var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Plus size={11} /> Rijbewijs toevoegen
          </button>
          {rijOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
              background: 'white', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 180 }}>
              {RIJBEWIJZEN.map(r => {
                const sel = rijbewijzen.includes(r)
                return (
                  <button key={r} onClick={() => tog(r, setRijbewijzen)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
                      background: sel ? 'var(--color-primary-bg, #EEF2FF)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                      border: `2px solid ${sel ? 'var(--color-primary)' : 'var(--border)'}`,
                      background: sel ? 'var(--color-primary)' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sel && <Check size={9} color="white" />}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{r}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ZzpTab({ c }) {
  const zzp = c.zzp ?? {}
  const [form, setForm] = useState({
    bedrijfsnaam:     zzp.company_name      ?? c.company_name      ?? '',
    kvk:              zzp.kvk_number        ?? c.kvk               ?? '',
    btw:              zzp.vat_number        ?? c.btw               ?? '',
    kor:              zzp.kor               ?? c.kor               ?? false,
    intracommunautair:zzp.intracommunautair ?? false,
    straat:           zzp.street            ?? '',
    huisnummer:       zzp.house_number      ?? '',
    postcode:         zzp.postal_code       ?? '',
    plaats:           zzp.city              ?? '',
    land:             zzp.country           ?? '',
    crediteur:        zzp.creditor_number   ?? '',
    email_zakelijk:   zzp.business_email    ?? '',
    email_factuur:    zzp.invoice_email     ?? '',
    iban:             zzp.iban              ?? c.iban               ?? '',
    self_billing:     zzp.self_billing      ?? false,
    betalingskorting: zzp.payment_discount  ?? '0,00',
    bemiddelingskosten:zzp.mediation_costs  ?? '0,00',
    betaaltermijn:    zzp.payment_term      ?? '',
  })
  const [editing, setEditing] = useState(false)
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const iStyle = { flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 6,
    border: '1px solid var(--border)', background: editing ? 'white' : 'var(--bg)',
    color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }

  const Row = ({ label, field, type = 'text', prefix }) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '9px 12px',
      borderBottom: '1px solid var(--border)', gap: 16, background: 'var(--surface)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 180, flexShrink: 0 }}>{label}</span>
      {type === 'checkbox' ? (
        <input type="checkbox" checked={!!form[field]} onChange={e => setF(field, e.target.checked)}
          disabled={!editing}
          style={{ width: 14, height: 14, accentColor: 'var(--color-primary)', cursor: editing ? 'pointer' : 'default' }} />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          {prefix && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{prefix}</span>}
          {editing
            ? <input value={form[field]} onChange={e => setF(field, e.target.value)} type={type} style={iStyle} />
            : <span style={{ fontSize: 12, color: 'var(--text)' }}>{form[field] || '-'}</span>
          }
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>ZZP'er</span>
        {!editing && (
          <button onClick={() => setEditing(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <Edit2 size={13} />
          </button>
        )}
      </div>

      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }}>
        <Row label="Bedrijfsnaam"                    field="bedrijfsnaam" />
        <Row label="KVK nummer"                      field="kvk" />
        <Row label="BTW nummer"                      field="btw" />
        <Row label="KOR / BTW vrijgesteld"           field="kor"               type="checkbox" />
        <Row label="Intracommunautaire levering"     field="intracommunautair" type="checkbox" />
        <Row label="Straat"                          field="straat" />
        <Row label="Huisnummer"                      field="huisnummer" />
        <Row label="Postcode"                        field="postcode" />
        <Row label="Plaats"                          field="plaats" />
        <Row label="Vestigingsland"                  field="land" />
        <Row label="Crediteurnummer"                 field="crediteur" />
        <Row label="Zakelijk e-mailadres"            field="email_zakelijk" type="email" />
        <Row label="Kopie factuur e-mailadres"       field="email_factuur"  type="email" />
        <Row label="IBAN"                            field="iban" />
        <Row label="Self Billing"                    field="self_billing"      type="checkbox" />
        <Row label="Betalingskorting uren en toeslagen" field="betalingskorting" />
        <Row label="Dagelijkse bemiddelingskosten"   field="bemiddelingskosten" prefix="€" />
        <Row label="Betaaltermijn"                   field="betaaltermijn" />
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(false)}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              background: 'var(--text)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Opslaan
          </button>
          <button onClick={() => setEditing(false)}
            style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8,
              background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            Annuleren
          </button>
        </div>
      )}
    </div>
  )
}

function NoteEditor({ value, onChange, expanded, onToggleExpand }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && !editor.isDestroyed && value === '') editor.commands.clearContent()
  }, [value, editor])

  if (!editor) return null

  const btnStyle = (active) => ({
    padding: '4px 7px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
    background: active ? 'var(--color-primary)' : 'none',
    color: active ? 'white' : 'var(--text-muted)',
    border: 'none', display: 'flex', alignItems: 'center',
  })

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button style={btnStyle(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title="Vet"><Bold size={13} /></button>
        <button style={btnStyle(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursief"><Italic size={13} /></button>
        <button style={btnStyle(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lijst"><List size={13} /></button>
        <button style={btnStyle(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Genummerde lijst"><ListOrdered size={13} /></button>
        <button style={btnStyle(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Kop"><Heading2 size={13} /></button>
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btnStyle(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Links"><AlignLeft size={13} /></button>
        <button style={btnStyle(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Midden"><AlignCenter size={13} /></button>
        <button style={btnStyle(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Rechts"><AlignRight size={13} /></button>
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btnStyle(false)} onClick={() => editor.chain().focus().undo().run()} title="Ongedaan maken"><Undo2 size={13} /></button>
        <button style={btnStyle(false)} onClick={() => editor.chain().focus().redo().run()} title="Opnieuw"><Redo2 size={13} /></button>
        <div style={{ flex: 1 }} />
        <button style={{ ...btnStyle(false), marginLeft: 4 }} onClick={onToggleExpand} title={expanded ? 'Verkleinen' : 'Vergroten'}>
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
      {/* Editor */}
      <EditorContent editor={editor} style={{ minHeight: expanded ? 320 : 120, padding: '10px 12px', fontSize: 13, color: 'var(--text)', cursor: 'text' }} />
    </div>
  )
}

export default function CandidateDrawer({ candidate: c, onClose, expanded, onToggleExpand, users = [] }) {
  const [activeTab,      setActiveTab]      = useState('profiel')
  const [recruiterOpen,  setRecruiterOpen]  = useState(false)
  const [recruiter,      setRecruiter]      = useState(null)
  const [statusOpen,     setStatusOpen]     = useState(false)
  const [status,         setStatus]         = useState(null)
  const [tags,           setTags]           = useState(null)
  const [addingTag,      setAddingTag]      = useState(false)
  const [tagInput,       setTagInput]       = useState('')
  const [docs,           setDocs]           = useState(null)
  const [vestigingen,    setVestigingen]    = useState(null)
  const [ervaring,       setErvaring]       = useState(null)
  const [opleiding,      setOpleiding]      = useState(null)
  const [talen,          setTalen]          = useState(null)
  const [certs,          setCerts]          = useState(null)
  const [vaardigheden,   setVaardigheden]   = useState(null)
  const [newNote,        setNewNote]        = useState('')
  const [newNoteTitle,   setNewNoteTitle]   = useState('')
  const [newNoteType,    setNewNoteType]    = useState('Algemeen')
  const [addingNote,     setAddingNote]     = useState(false)
  const [sollPage,       setSollPage]       = useState(1)
  const [editing,        setEditing]        = useState(false)
  const [profileEdits,   setProfileEdits]   = useState(null)
  const [previewDoc,     setPreviewDoc]     = useState(null)
  const [pendingFile,    setPendingFile]    = useState(null)
  const [pendingType,    setPendingType]    = useState('CV')
  const [renamingDoc,    setRenamingDoc]    = useState(null)
  const [renameValue,    setRenameValue]    = useState('')
  const [docSearch,      setDocSearch]      = useState('')
  const [photoUrl,       setPhotoUrl]       = useState(null)
  const [photoMenuOpen,  setPhotoMenuOpen]  = useState(false)
  const [noteExpanded,   setNoteExpanded]   = useState(false)

  const [vestigingOpen,   setVestigingOpen]   = useState(false)
  const [vestigingSearch, setVestigingSearch] = useState('')
  const [planningSubTab,       setPlanningSubTab]       = useState('beschikbaarheid')
  const [inplanningSelected,   setInplanningSelected]   = useState(null)
  const [inplanningFavorieten, setInplanningFavorieten] = useState({})
  const [allLocations,    setAllLocations]    = useState([])

  const recruiterRef   = useRef(null)
  const statusRef      = useRef(null)
  const fileRef        = useRef(null)
  const tagInputRef    = useRef(null)
  const photoRef       = useRef(null)
  const photoFileRef   = useRef(null)
  const vestigingRef   = useRef(null)
  const autoExpandedRef = useRef(false)

  useEffect(() => {
    setRecruiter(null); setActiveTab('profiel'); setStatus(null)
    setTags(null); setDocs(null); setVestigingen(null)
    setErvaring(null); setOpleiding(null); setTalen(null)
    setCerts(null); setVaardigheden(null); setSollPage(1)
    setAddingNote(false); setNewNote(''); setNewNoteTitle(''); setNewNoteType('Algemeen'); setEditing(false); setProfileEdits(null)
    setPreviewDoc(null); setPendingFile(null); setPendingType('CV'); setPhotoUrl(null); setPhotoMenuOpen(false); setNoteExpanded(false)
    setPlanningSubTab('beschikbaarheid')
    setInplanningSelected(null)
    setInplanningFavorieten({})
  }, [c?.id])

  useEffect(() => {
    if (activeTab === 'planning') {
      if (!expanded) {
        autoExpandedRef.current = true
        onToggleExpand?.()
      }
    } else if (autoExpandedRef.current && expanded) {
      autoExpandedRef.current = false
      onToggleExpand?.()
    }
  }, [activeTab])

  useEffect(() => {
    if (!recruiterOpen) return
    const h = e => { if (recruiterRef.current && !recruiterRef.current.contains(e.target)) setRecruiterOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [recruiterOpen])

  useEffect(() => {
    if (!statusOpen) return
    const h = e => { if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [statusOpen])

  useEffect(() => { if (addingTag && tagInputRef.current) tagInputRef.current.focus() }, [addingTag])

  useEffect(() => {
    if (!photoMenuOpen) return
    const h = e => { if (photoRef.current && !photoRef.current.contains(e.target)) setPhotoMenuOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [photoMenuOpen])

  useEffect(() => {
    api.get('/customers').then(r => {
      const d = r.data; setAllLocations(Array.isArray(d) ? d : (d?.data ?? []))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!vestigingOpen) return
    const h = e => { if (vestigingRef.current && !vestigingRef.current.contains(e.target)) setVestigingOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [vestigingOpen])

  if (!c) return null

  const currentStatus  = status ?? c.status
  const currentTags    = tags ?? c.tags ?? []
  const currentDocs    = docs ?? c.documenten ?? []
  const currentErvaring    = ervaring    ?? c.ervaring    ?? []
  const currentOpleiding   = opleiding   ?? c.opleiding   ?? []
  const currentTalen       = talen       ?? c.talen       ?? []
  const currentCerts       = certs       ?? c.certificeringen ?? []
  const currentVaardigheden = vaardigheden ?? c.vaardigheden ?? []
  const currentSoll        = c.sollicitaties ?? []

  // pagination for sollicitaties
  const SOLL_PER_PAGE = 5
  const sollPages  = Math.max(1, Math.ceil(currentSoll.length / SOLL_PER_PAGE))
  const sollSlice  = currentSoll.slice((sollPage - 1) * SOLL_PER_PAGE, sollPage * SOLL_PER_PAGE)

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profiel':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ProfielTab c={{ ...c, ...(profileEdits ?? {}) }}
              editing={editing} onEditSave={v => { setProfileEdits(v); setEditing(false) }} onEditCancel={() => setEditing(false)}
              onStartEdit={() => setEditing(true)} />
            <KoiosAiBlock c={{ ...c, ...(profileEdits ?? {}) }} />
            <TaalTab items={currentTalen} onAdd={v => setTalen(p => [...(p ?? c.talen ?? []), v])} />
            {/* Documenten */}
            <div style={sectionBlock}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Documenten</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Zoeken…"
                      style={{ border: 'none', outline: 'none', fontSize: 11, color: 'var(--text)', background: 'none', width: 110 }} />
                    {docSearch && <button onClick={() => setDocSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>}
                  </div>
                  <button onClick={() => fileRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Plus size={11} /> Toevoegen
                  </button>
                </div>
              </div>
              {pendingFile && (
                <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: '#EEF2FF' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    {pendingFile.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pendingFile.size})</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Document type</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {DOC_TYPES.map(t => (
                      <button key={t} onClick={() => setPendingType(t)}
                        style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer', fontWeight: pendingType === t ? 600 : 400,
                          border: `1px solid ${pendingType === t ? 'var(--color-primary)' : 'var(--border)'}`,
                          background: pendingType === t ? 'var(--color-primary)' : 'white', color: pendingType === t ? 'white' : 'var(--text)' }}>{t}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setDocs([...currentDocs, { name: pendingFile.name, size: pendingFile.size, type: pendingType, objectUrl: pendingFile.objectUrl }]); setPendingFile(null) }}
                      style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--text)', color: 'white', border: 'none', cursor: 'pointer' }}>Toevoegen</button>
                    <button onClick={() => { URL.revokeObjectURL(pendingFile.objectUrl); setPendingFile(null) }}
                      style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>Annuleren</button>
                  </div>
                </div>
              )}
              {currentDocs.length === 0 && !pendingFile && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Geen documenten.</div>}
              {currentDocs.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Naam</span><span>Type</span><span>Grootte</span>
                </div>
              )}
              {currentDocs.map((d, i) => ({ ...d, _i: i }))
                .filter(d => !docSearch || (d.name ?? d.file_name ?? '').toLowerCase().includes(docSearch.toLowerCase()) || (d.type ?? '').toLowerCase().includes(docSearch.toLowerCase()))
                .map(d => {
                  const i = d._i
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: DOC_COLORS[d.type] ?? '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={13} color="white" /></div>
                        {renamingDoc === i
                          ? <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { setDocs(currentDocs.map((x, j) => j === i ? { ...x, name: renameValue } : x)); setRenamingDoc(null) } if (e.key === 'Escape') setRenamingDoc(null) }}
                              onBlur={() => { setDocs(currentDocs.map((x, j) => j === i ? { ...x, name: renameValue } : x)); setRenamingDoc(null) }}
                              style={{ flex: 1, fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', boxSizing: 'border-box', minWidth: 0 }} />
                          : <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name ?? d.file_name}</span>
                        }
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: (DOC_COLORS[d.type] ?? '#6B7280') + '18', color: DOC_COLORS[d.type] ?? '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.type ?? '—'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.size ?? ''}</span>
                        <div style={{ display: 'flex' }}>
                          <button onClick={() => { setRenamingDoc(i); setRenameValue(d.name ?? d.file_name ?? '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Pencil size={12} /></button>
                          <button onClick={() => setPreviewDoc(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><Eye size={12} /></button>
                          <button onClick={() => setDocs(currentDocs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' }}><X size={12} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })
              }
            </div>
            {/* Vestiging */}
            <div style={sectionBlock}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Vestiging</div>
              {(vestigingen ?? c.vestiging ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(vestigingen ?? c.vestiging ?? []).map(v => (
                    <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px',
                      borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                      {v}
                      <button onClick={() => setVestigingen(prev => (prev ?? c.vestiging ?? []).filter(x => x !== v))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div ref={vestigingRef} style={{ position: 'relative' }}>
                <button onClick={() => setVestigingOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 500,
                    border: '1px dashed var(--border)', borderRadius: 7, background: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <Plus size={11} /> Vestiging koppelen
                </button>
                {vestigingOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, width: 240,
                    background: 'white', border: '1px solid var(--border)', borderRadius: 10,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                      <input value={vestigingSearch} onChange={e => setVestigingSearch(e.target.value)}
                        placeholder="Zoeken…" autoFocus
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {allLocations
                        .filter(l => (l.name ?? l.company_name ?? '').toLowerCase().includes(vestigingSearch.toLowerCase()))
                        .map(l => {
                          const name = l.name ?? l.company_name ?? l.id
                          const selected = (vestigingen ?? c.vestiging ?? []).includes(name)
                          return (
                            <button key={l.id ?? name}
                              onClick={() => setVestigingen(prev => { const cur = prev ?? c.vestiging ?? []; return selected ? cur.filter(x => x !== name) : [...cur, name] })}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', padding: '9px 12px', fontSize: 12, background: selected ? '#EEF2FF' : 'none',
                                border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                              {name}
                              {selected && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                            </button>
                          )
                        })
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      case 'achtergrond':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ErvaringTab items={currentErvaring} onAdd={v => setErvaring(p => [...(p ?? c.ervaring ?? []), v])} />
            <OpleidingTab items={currentOpleiding} onAdd={v => setOpleiding(p => [...(p ?? c.opleiding ?? []), v])} />
            <CertificeringenTab items={currentCerts} onAdd={v => setCerts(p => [...(p ?? c.certificeringen ?? []), v])} />
            <VaardighedenTab items={currentVaardigheden} onAdd={v => setVaardigheden(p => [...(p ?? c.vaardigheden ?? []), v])} />
          </div>
        )
      case 'werk':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PlaatsingenTab c={c} />
            <div style={sectionBlock}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                Sollicitaties <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{currentSoll.length}</span>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Vacature</div>
                {sollSlice.length === 0
                  ? <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Nog geen sollicitaties.</div>
                  : sollSlice.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: i < sollSlice.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12, color: 'var(--text)' }}>
                      {(s.logo_url ?? s.vacancy?.logo_url) && <img src={s.logo_url ?? s.vacancy?.logo_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />}
                      <span style={{ fontWeight: 500 }}>{s.vacature ?? s.vacancy?.title ?? s.title ?? '-'}</span>
                    </div>
                  ))
                }
              </div>
              {currentSoll.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{(sollPage - 1) * SOLL_PER_PAGE + 1}–{Math.min(sollPage * SOLL_PER_PAGE, currentSoll.length)} van {currentSoll.length}</span>
                  <button onClick={() => setSollPage(p => Math.max(1, p - 1))} disabled={sollPage <= 1} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: sollPage <= 1 ? 'default' : 'pointer', color: sollPage <= 1 ? 'var(--border)' : 'var(--text-muted)' }}>‹</button>
                  <button onClick={() => setSollPage(p => Math.min(sollPages, p + 1))} disabled={sollPage >= sollPages} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)', cursor: sollPage >= sollPages ? 'default' : 'pointer', color: sollPage >= sollPages ? 'var(--border)' : 'var(--text-muted)' }}>›</button>
                </div>
              )}
            </div>
          </div>
        )
      case 'planning':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Planning sub-tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              {[
                { id: 'beschikbaarheid', label: 'Beschikbaarheid' },
                { id: 'inplanning',      label: 'Inplanning'      },
                { id: 'functies',        label: 'Functies & Pools' },
              ].map(sub => (
                <button key={sub.id} onClick={() => setPlanningSubTab(sub.id)}
                  style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap', background: 'none', border: 'none',
                    borderBottom: planningSubTab === sub.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                    color: planningSubTab === sub.id ? 'var(--color-primary)' : 'var(--text-muted)',
                    fontWeight: planningSubTab === sub.id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
                  {sub.label}
                </button>
              ))}
            </div>
            {planningSubTab === 'beschikbaarheid' && <BeschikbaarheidAgenda />}
            {planningSubTab === 'inplanning' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {/* List */}
                <div style={{ ...sectionBlock, flex: inplanningSelected ? '0 0 270px' : '1', minWidth: 0, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={sectionTitle}>Komende diensten</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{DUMMY_DIENSTEN_LIST.length}</span>
                  </div>
                  {DUMMY_DIENSTEN_LIST.map((d, i) => {
                    const isSel = inplanningSelected === d
                    return (
                      <div key={i} onClick={() => setInplanningSelected(isSel ? null : d)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 8px', borderRadius: 7, marginBottom: 2, cursor: 'pointer',
                          background: isSel ? 'var(--bg)' : 'transparent',
                          border: isSel ? `1px solid ${d.color}` : '1px solid transparent' }}>
                        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: d.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{d.datum}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                              <Clock size={9} />{d.tijd}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.klant}</div>
                          {!inplanningSelected && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.functie}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                                <MapPin size={9} />{d.locatie}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Detail panel */}
                {inplanningSelected && (() => {
                  const d = inplanningSelected
                  const fav = inplanningFavorieten[d.datum + d.klant] ?? d.favoriet
                  const toggleFav = () => setInplanningFavorieten(p => ({ ...p, [d.datum + d.klant]: !fav }))
                  return (
                    <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                      {/* Detail header */}
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ width: 3, height: 38, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.klant}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.functie}</div>
                        </div>
                        <button onClick={toggleFav} title={fav ? 'Verwijder favoriet' : 'Favoriet'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: fav ? '#EF4444' : 'var(--text-muted)', display: 'flex' }}>
                          <Heart size={15} fill={fav ? '#EF4444' : 'none'} />
                        </button>
                        <button onClick={() => setInplanningSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex' }}>
                          <X size={14} />
                        </button>
                      </div>
                      {[
                        ['Datum',          d.datum],
                        ['Tijdstip',       d.tijd],
                        ['Locatie',        d.locatie],
                        ['Adres',          d.adres ?? '-'],
                        ['Eerder gewerkt', d.eerder_gewerkt > 0
                          ? `Ja, ${d.eerder_gewerkt}× bij ${d.klant}`
                          : `Nee, eerste keer bij ${d.klant}`],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', padding: '8px 14px', borderBottom: '1px solid var(--border)', gap: 10 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>{l}</span>
                          <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{v}</span>
                        </div>
                      ))}
                      {d.eerder_gewerkt > 0 && (
                        <div style={{ padding: '7px 14px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Check size={11} color="#16A34A" />
                          <span style={{ fontSize: 11, color: '#15803D', fontWeight: 500 }}>Bekend bij deze klant</span>
                        </div>
                      )}
                      {d.opmerkingen ? (
                        <div style={{ padding: '8px 14px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opmerkingen</div>
                          <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>{d.opmerkingen}</div>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}
              </div>
            )}
            {planningSubTab === 'functies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PlanningTab c={c} />
              </div>
            )}
          </div>
        )
      case 'voorkeuren':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <VoorkeurenTab c={c} />
          </div>
        )
      case 'statistieken':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Plaatsingen',   value: c.plaatsingen?.length ?? 0,    sub: 'totaal',   color: '#6366F1' },
                { label: 'Sollicitaties', value: currentSoll.length,             sub: 'totaal',   color: '#3B82F6' },
                { label: 'Diensten',      value: c.diensten_count ?? 24,         sub: 'dit jaar', color: '#22C55E' },
                { label: 'Uren gewerkt',  value: c.uren_gewerkt ?? 186,          sub: 'dit jaar', color: '#F59E0B' },
              ].map(k => (
                <div key={k.label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={sectionBlock}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Statusoverzicht</div>
              {[
                ['Status',          currentStatus ?? c.status ?? '-'],
                ['Laatste contact',  c.laatste_contact_datum ?? '-'],
                ['Soort contact',    c.laatste_contact_soort ?? '-'],
                ['Lid sinds',        c.created ?? '-'],
                ['Vestiging',        (vestigingen ?? c.vestiging ?? []).join(', ') || '-'],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{lbl}</span>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={sectionBlock}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Recente activiteit</div>
              {(c.tijdlijn ?? []).length === 0
                ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen activiteiten.</div>
                : (c.tijdlijn ?? []).slice(0, 5).map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{ev.text ?? ev.description}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{ev.time ?? ev.created_at}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )
      case 'administratie':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ZZP */}
            <ZzpTab c={c} />
          </div>
        )
      case 'communicatie':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Notities */}
            <div style={sectionBlock}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notities</span>
                {!addingNote && (
                  <button onClick={() => setAddingNote(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Plus size={11} /> Nieuwe notitie
                  </button>
                )}
              </div>
              {addingNote && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Type</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Algemeen','Intake','Feedback','Afspraak','Follow-up','Waarschuwing'].map(t => (
                        <button key={t} onClick={() => setNewNoteType(t)}
                          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 99, cursor: 'pointer',
                            border: `1px solid ${newNoteType === t ? 'var(--color-primary)' : 'var(--border)'}`,
                            background: newNoteType === t ? 'var(--color-primary)' : 'white',
                            color: newNoteType === t ? 'white' : 'var(--text)', fontWeight: newNoteType === t ? 600 : 400 }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} placeholder={`${newNoteType} notitie`}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
                  <NoteEditor value={newNote} onChange={setNewNote} expanded={noteExpanded} onToggleExpand={() => setNoteExpanded(e => !e)} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => { setAddingNote(false); setNewNote(''); setNewNoteTitle(''); setNewNoteType('Algemeen'); setNoteExpanded(false) }}
                      style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>Annuleer</button>
                    <button onClick={() => { setAddingNote(false); setNewNote(''); setNewNoteTitle(''); setNewNoteType('Algemeen'); setNoteExpanded(false) }}
                      style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, borderRadius: 8, background: 'var(--text)', color: 'white', border: 'none', cursor: 'pointer' }}>Opslaan</button>
                  </div>
                </div>
              )}
              {(c.notities ?? []).length === 0 && !addingNote
                ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen notities.</div>
                : (c.notities ?? []).map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <Avatar initials={c.ownerInitials} size={26} />
                      <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ flex: 1 }}>
                            {n.type && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: '#EEF2FF', color: '#4F46E5', marginRight: 6 }}>{n.type}</span>}
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.title ?? n.author}</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.ago}</span>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px' }}><MoreHorizontal size={14} /></button>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: n.text ?? n.body ?? '' }} />
                      </div>
                    </div>
                  ))
              }
            </div>
            {/* Tijdlijn */}
            <div style={sectionBlock}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Tijdlijn</div>
              {(c.tijdlijn ?? []).length > 0
                ? (c.tijdlijn ?? []).map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
                      <Avatar initials={c.initials} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.time ?? ev.created_at}</span>
                        </div>
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)' }}>{ev.text ?? ev.description}</div>
                      </div>
                    </div>
                  ))
                : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen activiteiten.</div>
              }
            </div>
            {/* Conversaties */}
            <div style={sectionBlock}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Conversaties</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nog geen conversaties.</div>
            </div>
          </div>
        )
      default: return null
    }
  }

  const tabCount = () => undefined

  return (
    <div style={{ width: expanded ? 880 : 580, flexShrink: 0, height: '100%',
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden' }}>

      {/* Top header */}
      <div style={{ padding: '14px 16px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', flex: 1 }}>Kandidaat</span>
          <button onClick={onToggleExpand} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          {/* Clickable avatar with photo menu */}
          <div ref={photoRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setPhotoMenuOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', position: 'relative', borderRadius: '50%' }}>
              <Avatar initials={c.initials} size={44} photo={photoUrl ?? c.photo} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0,
                transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <Camera size={14} color="white" />
              </div>
            </button>
            <input ref={photoFileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setPhotoUrl(URL.createObjectURL(f)); setPhotoMenuOpen(false) } }} />
            {photoMenuOpen && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: 'white',
                border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                overflow: 'hidden', minWidth: 140 }}>
                <button onClick={() => { photoFileRef.current?.click(); setPhotoMenuOpen(false) }}
                  style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 12, textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  Uploaden
                </button>
                <button onClick={() => { setPhotoUrl(''); setPhotoMenuOpen(false) }}
                  style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 12, textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  Verwijderen
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input placeholder="Voornaam" defaultValue={c.firstname ?? c.name?.split(' ')[0] ?? ''}
                    style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
                  <input placeholder="Achternaam" defaultValue={c.lastname ?? c.name?.split(' ').slice(-1)[0] ?? ''}
                    style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
                </div>
                <input placeholder="Tussenvoegsel" defaultValue={c.tussenvoegsel ?? ''}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', outline: 'none', color: 'var(--text-muted)' }} />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{profileEdits ? [c.firstname, c.tussenvoegsel, c.lastname].filter(Boolean).join(' ') || c.name : c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.title || '—'}</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {/* CV actions */}
            {(() => {
              const cvDoc = currentDocs.find(d => d.type === 'CV')
              const cvUrl = cvDoc?.objectUrl ?? cvDoc?.url ?? null
              return cvDoc ? (
                <>
                  <button onClick={() => setPreviewDoc(cvDoc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', fontSize: 11, fontWeight: 500, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                    <Eye size={11} /> CV
                  </button>
                  {cvUrl && (
                    <a href={cvUrl} download={cvDoc.name ?? 'CV'}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', fontSize: 11, fontWeight: 500, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', textDecoration: 'none' }}>
                      <Download size={11} />
                    </a>
                  )}
                </>
              ) : (
                <button onClick={() => { setPendingType('CV'); fileRef.current?.click() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', fontSize: 11, fontWeight: 500, borderRadius: 7, cursor: 'pointer', border: '1px dashed var(--border)', background: 'none', color: 'var(--text-muted)' }}>
                  <FileText size={11} /> CV uploaden
                </button>
              )
            })()}
            <button onClick={() => { setEditing(e => !e); setActiveTab('profiel') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                fontSize: 12, fontWeight: 500, borderRadius: 7, cursor: 'pointer',
                background: editing ? 'var(--color-primary)' : 'var(--bg)',
                color: editing ? '#fff' : 'var(--text)',
                border: editing ? 'none' : '1px solid var(--border)' }}>
              <Edit2 size={11} /> {editing ? 'Bewerken…' : 'Bewerken'}
            </button>
          </div>
        </div>

        {/* Status + Eigenaar row */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 6 }}>
          {/* Status */}
          <div style={{ paddingRight: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
            <div ref={statusRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button onClick={() => setStatusOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                  border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', cursor: 'pointer' }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{currentStatus}</span>
                <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
              {statusOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
                  background: 'white', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', minWidth: 140 }}>
                  {CANDIDATE_STATUSES.map(s => (
                    <button key={s} onClick={() => { setStatus(s); setStatusOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '8px 12px', textAlign: 'left',
                        fontSize: 12, background: currentStatus === s ? 'var(--color-primary-bg)' : 'none',
                        border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                      {s}
                      {currentStatus === s && <Check size={13} style={{ color: 'var(--color-primary)' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Divider */}
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, margin: '2px 0' }} />
          {/* Eigenaar */}
          <div style={{ flex: 1, paddingLeft: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Eigenaar</div>
            <div ref={recruiterRef} style={{ position: 'relative' }}>
              <button onClick={() => setRecruiterOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                  border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', cursor: 'pointer' }}>
                {(() => {
                  const u = recruiter ?? { name: c.owner, initials: c.ownerInitials }
                  const initials = u.initials ?? (u.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() ?? '?')
                  return <>
                    <Avatar initials={initials} size={18} />
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{u.name || '-'}</span>
                    <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
                  </>
                })()}
              </button>
              {recruiterOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, width: 200,
                  background: 'white', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  {users.length === 0
                    ? <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Geen gebruikers</div>
                    : users.map(u => {
                        const initials = u.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() ?? '??'
                        const selected = (recruiter?.id ?? null) === u.id
                        return (
                          <button key={u.id} onClick={() => { setRecruiter({ ...u, initials }); setRecruiterOpen(false) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                              background: selected ? 'var(--color-primary-bg)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                            <Avatar initials={initials} size={20} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{u.name}</span>
                          </button>
                        )
                      })
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Laatste contact row */}
        {(c.laatste_contact_datum || c.laatste_contact_soort) && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            Laatste contact:&nbsp;
            {c.laatste_contact_datum && <span style={{ color: 'var(--text)' }}>{c.laatste_contact_datum}</span>}
            {c.laatste_contact_datum && c.laatste_contact_soort && <span> · </span>}
            {c.laatste_contact_soort && <span style={{ color: 'var(--text)' }}>{c.laatste_contact_soort}</span>}
          </div>
        )}
        {!c.laatste_contact_datum && !c.laatste_contact_soort && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            Laatste contact: <span style={{ fontStyle: 'italic' }}>nog niet geregistreerd</span>
          </div>
        )}

        {/* Tags */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {currentTags.map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 8px', borderRadius: 99,
                border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                {t}
                <button onClick={() => setTags(currentTags.filter(x => x !== t))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 13 }}>×</button>
              </span>
            ))}
            {!addingTag && (
              <button onClick={() => setAddingTag(true)}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99,
                  border: '1px dashed var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>+</button>
            )}
          </div>
          {addingTag && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input ref={tagInputRef} value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) { setTags([...currentTags, tagInput.trim()]); setTagInput(''); setAddingTag(false) }
                  if (e.key === 'Escape') { setTagInput(''); setAddingTag(false) }
                }}
                placeholder="Tag"
                style={{ padding: '9px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
              <SaveCancel
                onSave={() => { if (tagInput.trim()) setTags([...currentTags, tagInput.trim()]); setTagInput(''); setAddingTag(false) }}
                onCancel={() => { setTagInput(''); setAddingTag(false) }} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', gap: 0, marginBottom: -1 }}>
          {TABS.map(tab => {
            const count = tabCount(tab)
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap', background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
                  fontWeight: activeTab === tab.id ? 600 : 400, cursor: 'pointer', marginBottom: -1 }}>
                {tab.label}{count !== undefined ? ` ${count}` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* Tab content */}
        <div style={{ marginBottom: 20 }}>
          {renderTabContent()}
        </div>

        {/* hidden file input needed for documenten tab */}
        <input ref={fileRef} type="file" style={{ display: 'none' }} multiple
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const objectUrl = URL.createObjectURL(file)
            setPendingFile({ file, objectUrl, name: file.name, size: Math.round(file.size / 1024) + ' KB' })
            setPendingType('CV')
            e.target.value = ''
          }} />
        {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aangemaakt op {c.created ?? '—'}</span>
      </div>
    </div>
  )
}
