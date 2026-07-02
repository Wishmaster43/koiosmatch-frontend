/**
 * CandidateCustomFieldsSettings — CRUD + reorder for tenant-defined candidate
 * fields. Definitions come from /custom-fields?entity_type=candidate. Type is immutable once
 * a field has data (has_data → type selector disabled). Key (slug) is immutable
 * after create. Delete with data → 409 (in_use).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import api from '@/lib/api'

// Field types the backend supports.
const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'boolean', 'select']

// Generate a slug from a label (lowercase, letters/numbers/underscores only).
const toSlug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

// Pick a label for the active language (fallback lang-base → en → nl → any → key).
const pickLabel = (l, lang, key) => l ? (l[lang] ?? l[lang.split('-')[0]] ?? l.en ?? l.nl ?? Object.values(l)[0] ?? key) : key
// Map a generic /custom-fields def to the shape this editor renders (label + has_data).
const toField = (d, lang) => ({ ...d, label: pickLabel(d.label_i18n, lang, d.key), has_data: !!d.in_use })

const cardStyle = {
  background: 'white', border: '1px solid #F3F4F6', borderRadius: 10, padding: '14px 16px', marginBottom: 8,
}
const inputStyle = {
  padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const labelStyle = { fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 4 }

export default function CandidateCustomFieldsSettings() {
  const { t, i18n } = useTranslation('settings')
  const [fields,   setFields]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(null)
  const [newForm,  setNewForm]  = useState({ label: '', key: '', type: 'text', options: '', required_for: '' })
  const [editForms, setEditForms] = useState({})

  // Load definitions on mount (unified /custom-fields; normalise to this editor's shape).
  useEffect(() => {
    api.get('/custom-fields', { params: { entity_type: 'candidate' } })
      .then(r => setFields((r.data?.data ?? r.data ?? []).map(d => toField(d, i18n.language))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [i18n.language])

  // Move a field one position up or down via POST /custom-fields/reorder.
  const reorder = async (id, dir) => {
    const idx = fields.findIndex(f => f.id === id)
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === fields.length - 1)) return
    const next = [...fields]
    ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
    setFields(next)
    await api.post('/custom-fields/reorder', { ids: next.map(f => f.id) }).catch(() => {})
  }

  // Toggle active without opening the full edit card.
  const toggleActive = async (field) => {
    const patched = { ...field, active: !field.active }
    setFields(p => p.map(f => f.id === field.id ? patched : f))
    await api.patch(`/custom-fields/${field.id}`, { active: patched.active }).catch(() => {
      setFields(p => p.map(f => f.id === field.id ? field : f))
    })
  }

  // Create a new field.
  const handleCreate = async () => {
    const label = newForm.label.trim()
    if (!label) return
    setSaving('new')
    try {
      const payload = {
        entity_type: 'candidate',
        key:   newForm.key.trim() || toSlug(label),
        label_i18n: { en: label, [i18n.language]: label },
        type:  newForm.type,
        options: newForm.type === 'select' ? newForm.options.split(',').map(s => s.trim()).filter(Boolean) : [],
      }
      const res = await api.post('/custom-fields', payload)
      const d = res.data?.data ?? res.data
      setFields(p => [...p, toField(d, i18n.language)])
      setNewForm({ label: '', key: '', type: 'text', options: '', required_for: '' })
      setAdding(false)
    } catch { /* noop */ } finally { setSaving(null) }
  }

  // Save edits to an existing field.
  const handleSave = async (field) => {
    const form = editForms[field.id] ?? {}
    setSaving(field.id)
    try {
      const newLabel = form.label ?? field.label
      const payload = {
        label_i18n: { ...(field.label_i18n ?? {}), [i18n.language]: newLabel },
        active:  form.active ?? field.active,
        options: (form.type ?? field.type) === 'select'
          ? (form.options ?? (field.options ?? []).join(', ')).split(',').map(s => s.trim()).filter(Boolean)
          : field.options,
      }
      if (!field.has_data) payload.type = form.type ?? field.type
      const res = await api.patch(`/custom-fields/${field.id}`, payload)
      const d = res.data?.data ?? res.data
      setFields(p => p.map(f => f.id === field.id ? toField(d, i18n.language) : f))
      setExpanded(null)
    } catch { /* noop */ } finally { setSaving(null) }
  }

  // Delete — blocked if has_data (409 from backend or has_data flag on item).
  const handleDelete = async (field) => {
    if (field.has_data) return
    setSaving(field.id)
    try {
      await api.delete(`/custom-fields/${field.id}`)
      setFields(p => p.filter(f => f.id !== field.id))
      if (expanded === field.id) setExpanded(null)
    } catch (e) {
      if (e?.response?.status === 409) setFields(p => p.map(f => f.id === field.id ? { ...f, has_data: true } : f))
    } finally { setSaving(null) }
  }

  const setEF = (id, k, v) => setEditForms(p => ({ ...p, [id]: { ...(p[id] ?? {}), [k]: v } }))

  if (loading) return <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13 }}>{t('common.loading')}</div>

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('candidateCustomFields.title')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t('candidateCustomFields.subtitle')}</p>
      </div>

      {/* Field list */}
      {fields.map((field, idx) => {
        const isOpen = expanded === field.id
        const ef = editForms[field.id] ?? {}
        const currentType = ef.type ?? field.type
        return (
          <div key={field.id} style={{ ...cardStyle, opacity: field.active ? 1 : 0.6 }}>
            {/* Row summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Reorder arrows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button onClick={() => reorder(field.id, -1)} disabled={idx === 0}
                  style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: '#D1D5DB', padding: 0, lineHeight: 1 }}>
                  <ChevronUp size={13} />
                </button>
                <button onClick={() => reorder(field.id, 1)} disabled={idx === fields.length - 1}
                  style={{ background: 'none', border: 'none', cursor: idx === fields.length - 1 ? 'default' : 'pointer', color: '#D1D5DB', padding: 0, lineHeight: 1 }}>
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* Label + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{field.label}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>{field.key}</code>
                  {' · '}{t(`candidateCustomFields.types.${field.type}`)}
                  {field.has_data && <span style={{ color: '#F59E0B', marginLeft: 6 }}>· {t('candidateCustomFields.hasData')}</span>}
                </div>
              </div>

              {/* Active toggle */}
              <button onClick={() => toggleActive(field)} title={field.active ? t('candidateCustomFields.deactivate') : t('candidateCustomFields.activate')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: field.active ? 'var(--color-primary)' : '#9CA3AF', padding: 4 }}>
                {field.active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              {/* Expand / collapse */}
              <button onClick={() => setExpanded(isOpen ? null : field.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Expanded edit form */}
            {isOpen && (
              <div style={{ marginTop: 14, borderTop: '1px solid #F3F4F6', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Label */}
                <div>
                  <label style={labelStyle}>{t('candidateCustomFields.label')}</label>
                  <input value={ef.label ?? field.label} onChange={e => setEF(field.id, 'label', e.target.value)} style={inputStyle} />
                </div>

                {/* Key (immutable) */}
                <div>
                  <label style={labelStyle}>{t('candidateCustomFields.key')} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({t('candidateCustomFields.immutable')})</span></label>
                  <input value={field.key} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                </div>

                {/* Type — disabled if has_data */}
                <div>
                  <label style={labelStyle}>{t('candidateCustomFields.type')} {field.has_data && <span style={{ color: '#F59E0B', fontWeight: 400 }}>({t('candidateCustomFields.hasData')})</span>}</label>
                  <select value={currentType} onChange={e => setEF(field.id, 'type', e.target.value)}
                    disabled={field.has_data} style={{ ...inputStyle, cursor: field.has_data ? 'not-allowed' : 'pointer', opacity: field.has_data ? 0.5 : 1 }}>
                    {FIELD_TYPES.map(tp => <option key={tp} value={tp}>{t(`candidateCustomFields.types.${tp}`)}</option>)}
                  </select>
                </div>

                {/* Options — only for select type */}
                {currentType === 'select' && (
                  <div>
                    <label style={labelStyle}>{t('candidateCustomFields.options')}</label>
                    <input value={ef.options ?? (field.options ?? []).join(', ')} onChange={e => setEF(field.id, 'options', e.target.value)}
                      placeholder={t('candidateCustomFields.optionsPlaceholder')} style={inputStyle} />
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{t('candidateCustomFields.optionsHint')}</p>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
                  <button onClick={() => handleDelete(field)} disabled={field.has_data || saving === field.id}
                    title={field.has_data ? t('candidateCustomFields.deleteBlocked') : t('candidateCustomFields.delete')}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12,
                             borderRadius: 6, border: '1px solid #FCA5A5', background: field.has_data ? '#F9FAFB' : '#FEF2F2',
                             color: field.has_data ? '#9CA3AF' : '#EF4444', cursor: field.has_data ? 'not-allowed' : 'pointer' }}>
                    <Trash2 size={12} /> {t('candidateCustomFields.delete')}
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setExpanded(null)}
                      style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'white', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => handleSave(field)} disabled={saving === field.id}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                      {saving === field.id ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add new field */}
      {adding ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>{t('candidateCustomFields.label')} *</label>
                <input value={newForm.label} onChange={e => setNewForm(p => ({ ...p, label: e.target.value, key: toSlug(e.target.value) }))}
                  placeholder={t('candidateCustomFields.labelPlaceholder')} style={inputStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>{t('candidateCustomFields.key')}</label>
                <input value={newForm.key} onChange={e => setNewForm(p => ({ ...p, key: e.target.value }))}
                  placeholder={t('candidateCustomFields.keyPlaceholder')} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('candidateCustomFields.type')}</label>
              <select value={newForm.type} onChange={e => setNewForm(p => ({ ...p, type: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {FIELD_TYPES.map(tp => <option key={tp} value={tp}>{t(`candidateCustomFields.types.${tp}`)}</option>)}
              </select>
            </div>
            {newForm.type === 'select' && (
              <div>
                <label style={labelStyle}>{t('candidateCustomFields.options')}</label>
                <input value={newForm.options} onChange={e => setNewForm(p => ({ ...p, options: e.target.value }))}
                  placeholder={t('candidateCustomFields.optionsPlaceholder')} style={inputStyle} />
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{t('candidateCustomFields.optionsHint')}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdding(false)}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'white', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={!newForm.label.trim() || saving === 'new'}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                {saving === 'new' ? t('common.saving') : t('candidateCustomFields.add')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 8,
                   border: '1px dashed #D1D5DB', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> {t('candidateCustomFields.add')}
        </button>
      )}
    </div>
  )
}
