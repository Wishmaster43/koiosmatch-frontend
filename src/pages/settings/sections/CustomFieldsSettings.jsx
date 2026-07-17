/**
 * CustomFieldsSettings — the ONE settings editor for tenant custom fields, shared by
 * every entity (§3B "Eigen velden" wave). Parameterized by `entityType` (the unified
 * GET/POST /custom-fields?entity_type=X surface) so there is a single CRUD/reorder
 * implementation instead of one editor per entity drifting apart — this generalises
 * the former CandidateCustomFieldsSettings + VacancySettings' VacancyFieldsSettings
 * (both removed; see registry.jsx and VacancySettings.jsx for the pointer comments).
 * CRUD + reorder + in-use protection: type is immutable once a field has data
 * (has_data → type selector disabled); key (slug) is immutable after create;
 * delete with data → 409 (in_use).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useCustomFields } from '@/lib/useCustomFields'
import { DragList } from '../components/SettingsControls'

// Field types the backend supports.
const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'boolean', 'select']

// entity_type → the nav.<id> label already registered for its sub-tab (registry.jsx),
// reused here as the human-readable entity name instead of a second hardcoded map.
const ENTITY_NAV_ID = {
  candidate: 'cf_candidate', application: 'cf_application', match: 'cf_match', vacancy: 'cf_vacancy',
  task: 'cf_task', opportunity: 'cf_opportunity', outreach_campaign: 'cf_outreach_campaign',
  customer: 'cf_customer', customer_location: 'cf_customer_location',
  customer_department: 'cf_customer_department', customer_contact: 'cf_customer_contact',
}

// Generate a slug from a label (lowercase, letters/numbers/underscores only).
const toSlug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

// Pick a label for the active language (fallback lang-base → en → nl → any → key).
const pickLabel = (l, lang, key) => l ? (l[lang] ?? l[lang.split('-')[0]] ?? l.en ?? l.nl ?? Object.values(l)[0] ?? key) : key
// Map a generic /custom-fields def to the shape this editor renders (label + has_data).
const toField = (d, lang) => ({ ...d, label: pickLabel(d.label_i18n, lang, d.key), has_data: !!d.in_use })

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8,
}
const inputStyle = {
  padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }

export default function CustomFieldsSettings({ entityType }) {
  const { t, i18n } = useTranslation('settings')
  const { invalidate } = useCustomFields(entityType)
  const entityLabel = t(`nav.${ENTITY_NAV_ID[entityType] ?? entityType}`)
  const [fields,   setFields]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(null)
  const [newForm,  setNewForm]  = useState({ label: '', key: '', type: 'text', options: '' })
  const [editForms, setEditForms] = useState({})

  // Load definitions whenever the entity or language changes (unified /custom-fields).
  useEffect(() => {
    setLoading(true)
    api.get('/custom-fields', { params: { entity_type: entityType } })
      .then(r => setFields((unwrapList(r).rows).map(d => toField(d, i18n.language))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [entityType, i18n.language])

  // Persist a drag-reordered list (same mechanism as the contract-forms lookup
  // editor's DragList — one shared drag implementation, not a per-screen redo).
  // Optimistic: apply locally first, POST the full id order, reconcile invalidate.
  const reorder = async (next) => {
    setFields(next)
    await api.post('/custom-fields/reorder', { ids: next.map(f => f.id) }).catch(() => {})
    invalidate()
  }

  // Toggle active without opening the full edit card.
  const toggleActive = async (field) => {
    const patched = { ...field, active: !field.active }
    setFields(p => p.map(f => f.id === field.id ? patched : f))
    await api.patch(`/custom-fields/${field.id}`, { active: patched.active })
      .then(() => invalidate())
      .catch(() => { setFields(p => p.map(f => f.id === field.id ? field : f)) })
  }

  // Create a new field.
  const handleCreate = async () => {
    const label = newForm.label.trim()
    if (!label) return
    setSaving('new')
    try {
      const payload = {
        entity_type: entityType,
        key:   newForm.key.trim() || toSlug(label),
        label_i18n: { en: label, [i18n.language]: label },
        type:  newForm.type,
        options: newForm.type === 'select' ? newForm.options.split(',').map(s => s.trim()).filter(Boolean) : [],
      }
      const res = await api.post('/custom-fields', payload)
      const d = unwrap(res)
      setFields(p => [...p, toField(d, i18n.language)])
      setNewForm({ label: '', key: '', type: 'text', options: '' })
      setAdding(false)
      invalidate()
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
      const d = unwrap(res)
      setFields(p => p.map(f => f.id === field.id ? toField(d, i18n.language) : f))
      setExpanded(null)
      invalidate()
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
      invalidate()
    } catch (e) {
      if (e?.response?.status === 409) setFields(p => p.map(f => f.id === field.id ? { ...f, has_data: true } : f))
    } finally { setSaving(null) }
  }

  const setEF = (id, k, v) => setEditForms(p => ({ ...p, [id]: { ...(p[id] ?? {}), [k]: v } }))

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div>

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header — entity name interpolated from the sub-tab's own nav label. */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('customFieldsSettings.title', { entity: entityLabel })}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t('customFieldsSettings.subtitle')}</p>
      </div>

      {/* Field list — drag-to-reorder via the shared DragList (same mechanism as the
          contract-forms lookup editor, CandidateLookupsSettings' LookupBlock). The grip
          drags the whole card; renderItem returns one flex:1 column so the header row +
          the optional expanded edit form both sit to the right of the handle. */}
      <DragList
        items={fields}
        onReorder={reorder}
        renderItem={(field) => {
          const isOpen = expanded === field.id
          const ef = editForms[field.id] ?? {}
          const currentType = ef.type ?? field.type
          return (
            <div style={{ ...cardStyle, flex: 1, minWidth: 0, marginBottom: 0, opacity: field.active ? 1 : 0.6 }}>
              {/* Row summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Label + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{field.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>{field.key}</code>
                    {' · '}{t(`customFieldsSettings.types.${field.type}`)}
                    {field.has_data && <span style={{ color: 'var(--color-warning)', marginLeft: 6 }}>· {t('customFieldsSettings.hasData')}</span>}
                  </div>
                </div>

                {/* Active toggle */}
                <button onClick={() => toggleActive(field)} title={field.active ? t('customFieldsSettings.deactivate') : t('customFieldsSettings.activate')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: field.active ? 'var(--color-primary)' : 'var(--text-muted)', padding: 4 }}>
                  {field.active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                {/* Expand / collapse */}
                <button onClick={() => setExpanded(isOpen ? null : field.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Expanded edit form */}
              {isOpen && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Label */}
                  <div>
                    <label style={labelStyle}>{t('customFieldsSettings.label')}</label>
                    <input value={ef.label ?? field.label} onChange={e => setEF(field.id, 'label', e.target.value)} style={inputStyle} />
                  </div>

                  {/* Key (immutable) */}
                  <div>
                    <label style={labelStyle}>{t('customFieldsSettings.key')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('customFieldsSettings.immutable')})</span></label>
                    <input value={field.key} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                  </div>

                  {/* Type — disabled if has_data */}
                  <div>
                    <label style={labelStyle}>{t('customFieldsSettings.type')} {field.has_data && <span style={{ color: 'var(--color-warning)', fontWeight: 400 }}>({t('customFieldsSettings.hasData')})</span>}</label>
                    <select value={currentType} onChange={e => setEF(field.id, 'type', e.target.value)}
                      disabled={field.has_data} style={{ ...inputStyle, cursor: field.has_data ? 'not-allowed' : 'pointer', opacity: field.has_data ? 0.5 : 1 }}>
                      {FIELD_TYPES.map(tp => <option key={tp} value={tp}>{t(`customFieldsSettings.types.${tp}`)}</option>)}
                    </select>
                  </div>

                  {/* Options — only for select type */}
                  {currentType === 'select' && (
                    <div>
                      <label style={labelStyle}>{t('customFieldsSettings.options')}</label>
                      <input value={ef.options ?? (field.options ?? []).join(', ')} onChange={e => setEF(field.id, 'options', e.target.value)}
                        placeholder={t('customFieldsSettings.optionsPlaceholder')} style={inputStyle} />
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{t('customFieldsSettings.optionsHint')}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
                    <button onClick={() => handleDelete(field)} disabled={field.has_data || saving === field.id}
                      title={field.has_data ? t('customFieldsSettings.deleteBlocked') : t('customFieldsSettings.delete')}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12,
                               borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', background: field.has_data ? 'var(--hover-bg)' : 'var(--color-danger-bg)',
                               color: field.has_data ? 'var(--text-muted)' : 'var(--color-danger)', cursor: field.has_data ? 'not-allowed' : 'pointer' }}>
                      <Trash2 size={12} /> {t('customFieldsSettings.delete')}
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setExpanded(null)}
                        style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
        }}
      />

      {/* Add new field */}
      {adding ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>{t('customFieldsSettings.label')} *</label>
                <input value={newForm.label} onChange={e => setNewForm(p => ({ ...p, label: e.target.value, key: toSlug(e.target.value) }))}
                  placeholder={t('customFieldsSettings.labelPlaceholder')} style={inputStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>{t('customFieldsSettings.key')}</label>
                <input value={newForm.key} onChange={e => setNewForm(p => ({ ...p, key: e.target.value }))}
                  placeholder={t('customFieldsSettings.keyPlaceholder')} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('customFieldsSettings.type')}</label>
              <select value={newForm.type} onChange={e => setNewForm(p => ({ ...p, type: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {FIELD_TYPES.map(tp => <option key={tp} value={tp}>{t(`customFieldsSettings.types.${tp}`)}</option>)}
              </select>
            </div>
            {newForm.type === 'select' && (
              <div>
                <label style={labelStyle}>{t('customFieldsSettings.options')}</label>
                <input value={newForm.options} onChange={e => setNewForm(p => ({ ...p, options: e.target.value }))}
                  placeholder={t('customFieldsSettings.optionsPlaceholder')} style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{t('customFieldsSettings.optionsHint')}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdding(false)}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={!newForm.label.trim() || saving === 'new'}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                {saving === 'new' ? t('common.saving') : t('customFieldsSettings.add')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 8,
                   border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> {t('customFieldsSettings.add')}
        </button>
      )}
    </div>
  )
}
