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
import { Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Monitor, MonitorOff } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useCustomFields } from '@/lib/useCustomFields'
import { notifyError } from '@/lib/notify'
import SearchSelect from '@/components/ui/SearchSelect'
import { DragList } from '../components/SettingsControls'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import { Caption, PageTitle } from '@/components/ui/typography'

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
// Map a generic /custom-fields def to the shape this editor renders (label + has_data)
// visible_in_ui defaults true (backend default) — worklist #44: API-only fields stay
// listed and editable here, they only stop rendering on the entity's Extra tab.
const toField = (d, lang) => ({ ...d, label: pickLabel(d.label_i18n, lang, d.key), has_data: !!d.in_use, visible_in_ui: d.visible_in_ui !== false })

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8,
}
// Canon field style (G33/fieldMetrics) — was its own padding-6/radius-6 copy.
const inputStyle = fieldInputStyle
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }

// See the file's top doc above; the one custom-fields CRUD editor, parameterized per entity type.
export default function CustomFieldsSettings({ entityType }) {
  const { t, i18n } = useTranslation('settings')
  const { invalidate } = useCustomFields(entityType)
  const entityLabel = t(`nav.${ENTITY_NAV_ID[entityType] ?? entityType}`)
  const [fields,   setFields]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(null)
  const [newForm,  setNewForm]  = useState({ label: '', key: '', type: 'text', options: '' })
  const [editForms, setEditForms] = useState({})

  // Load definitions whenever the entity or language changes (unified /custom-fields).
  // An alive guard stops a stale response from a previous entity tab overwriting a newer one.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    api.get('/custom-fields', { params: { entity_type: entityType } })
      .then(r => { if (alive) setFields((unwrapList(r).rows).map(d => toField(d, i18n.language))) })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [entityType, i18n.language])

  // Persist a drag-reordered list (same mechanism as the contract-forms lookup
  // editor's DragList — one shared drag implementation, not a per-screen redo).
  // Optimistic: apply locally first, POST the full id order (body verified against
  // CustomFieldController::reorder, koiosmatch-api: { ids: uuid[] }). A failed POST
  // reverts the optimistic order and notifies — mirrors the contract-forms editor's
  // reorder (CandidateLookupsSettings.jsx), never a silent catch (§13).
  const reorder = async (next) => {
    const previous = fields
    setFields(next)
    try {
      await api.post('/custom-fields/reorder', { ids: next.map(f => f.id) })
      invalidate()
    } catch {
      setFields(previous)
      notifyError(t('statusList.saveFailed'))
    }
  }

  // Toggle active without opening the full edit card.
  const toggleActive = async (field) => {
    const patched = { ...field, active: !field.active }
    setFields(p => p.map(f => f.id === field.id ? patched : f))
    await api.patch(`/custom-fields/${field.id}`, { active: patched.active })
      .then(() => invalidate())
      .catch(() => { setFields(p => p.map(f => f.id === field.id ? field : f)) })
  }

  // Worklist #44: toggle visible_in_ui without opening the full edit card — the
  // field stays active/writable via the API either way, this only hides it from
  // the entity's Extra tab. Optimistic with rollback on failure, then invalidate
  // so every open drawer's gated tab list refetches the new state.
  const toggleVisibleInUi = async (field) => {
    const patched = { ...field, visible_in_ui: !field.visible_in_ui }
    setFields(p => p.map(f => f.id === field.id ? patched : f))
    await api.patch(`/custom-fields/${field.id}`, { visible_in_ui: patched.visible_in_ui })
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
  if (loadError) return <div style={{ padding: 24, color: 'var(--color-danger-text)', fontSize: 13 }}>{t('statusList.loadError')}</div>

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header — entity name interpolated from the sub-tab's own nav label. */}
      <div style={{ marginBottom: 20 }}>
        <PageTitle>{t('customFieldsSettings.title', { entity: entityLabel })}</PageTitle>
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
                  <Caption as="div">
                    <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>{field.key}</code>
                    {' · '}{t(`customFieldsSettings.types.${field.type}`)}
                    {field.has_data && <span style={{ color: 'var(--color-warning-text)', marginLeft: 6 }}>· {t('customFieldsSettings.hasData')}</span>}
                    {/* Worklist #44: legible in words, not just icon colour — a tenant
                        must understand WHY a field they configured isn't showing up. */}
                    {!field.visible_in_ui && <span style={{ color: 'var(--color-info)', marginLeft: 6 }}>· {t('customFieldsSettings.apiOnly')}</span>}
                  </Caption>
                </div>

                {/* Active toggle */}
                <Button variant="ghost" iconOnly onClick={() => toggleActive(field)} title={field.active ? t('customFieldsSettings.deactivate') : t('customFieldsSettings.activate')}
                  aria-label={field.active ? t('customFieldsSettings.deactivate') : t('customFieldsSettings.activate')}
                  style={{ color: field.active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                  {field.active ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>

                {/* Visible-in-UI toggle (worklist #44) — independent of active: the field
                    stays reachable via the API/imports either way, this only hides it from
                    the entity's rendered Extra tab. Monitor/MonitorOff so it reads as a
                    distinct control from the Eye/EyeOff active toggle above. */}
                <Button variant="ghost" iconOnly onClick={() => toggleVisibleInUi(field)} title={field.visible_in_ui ? t('customFieldsSettings.hideFromUi') : t('customFieldsSettings.showInUi')}
                  aria-label={field.visible_in_ui ? t('customFieldsSettings.hideFromUi') : t('customFieldsSettings.showInUi')}
                  style={{ color: field.visible_in_ui ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                  {field.visible_in_ui ? <Monitor size={14} /> : <MonitorOff size={14} />}
                </Button>

                {/* Expand / collapse */}
                <Button variant="ghost" iconOnly onClick={() => setExpanded(isOpen ? null : field.id)}
                  aria-label={isOpen ? t('common:collapse') : t('common:expand')}>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
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

                  {/* Type — locked once the field has data: switching type on stored
                      values has no safe conversion (e.g. text -> number), so the
                      selector goes inert via SearchSelect's own `disabled` prop
                      (the single source of truth — no per-callsite guard/styling). */}
                  <div>
                    <label style={labelStyle}>{t('customFieldsSettings.type')} {field.has_data && <span style={{ color: 'var(--color-warning-text)', fontWeight: 400 }}>({t('customFieldsSettings.hasData')})</span>}</label>
                    {/* Herhaal-audit r4 finding 5/6/7: SearchSelect's own default
                        single-pick trigger face (closeOnToggle, no renderTrigger) —
                        never a hand-painted trigger button per call site. */}
                    <SearchSelect
                      options={FIELD_TYPES.map(tp => ({ value: tp, label: t(`customFieldsSettings.types.${tp}`) }))}
                      selected={[currentType]}
                      onToggle={v => setEF(field.id, 'type', v)}
                      closeOnToggle
                      searchable={false}
                      disabled={field.has_data}
                      triggerLabel={t(`customFieldsSettings.types.${currentType}`)}
                    />
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

                  {/* Actions — herhaal-audit r4 finding 4: Button's own dangerSoft/
                      secondary recipe covers the disabled look; no per-callsite
                      background/colour ternary needed anymore. */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
                    <Button variant="dangerSoft" size="sm" onClick={() => handleDelete(field)} disabled={field.has_data || saving === field.id}
                      title={field.has_data ? t('customFieldsSettings.deleteBlocked') : t('customFieldsSettings.delete')}>
                      <Trash2 size={12} /> {t('customFieldsSettings.delete')}
                    </Button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="secondary" size="sm" onClick={() => setExpanded(null)}>{t('common.cancel')}</Button>
                      <Button variant="primary" size="sm" onClick={() => handleSave(field)} disabled={saving === field.id}>
                        {saving === field.id ? t('common.saving') : t('common.save')}
                      </Button>
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
              {/* Herhaal-audit r4 finding 5/6/7: SearchSelect's own default trigger face. */}
              <SearchSelect
                options={FIELD_TYPES.map(tp => ({ value: tp, label: t(`customFieldsSettings.types.${tp}`) }))}
                selected={[newForm.type]}
                onToggle={v => setNewForm(p => ({ ...p, type: v }))}
                closeOnToggle
                searchable={false}
                triggerLabel={t(`customFieldsSettings.types.${newForm.type}`)}
              />
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
              <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newForm.label.trim() || saving === 'new'}>
                {saving === 'new' ? t('common.saving') : t('customFieldsSettings.add')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Full-width trigger: Button variant="soft" (§4 tint), not DrawerAddButton — this
        // spans the whole card, unlike the row-level "+ add" affordance.
        <Button variant="soft" size="sm" onClick={() => setAdding(true)} style={{ width: '100%' }}>
          <Plus size={14} /> {t('customFieldsSettings.add')}
        </Button>
      )}
    </div>
  )
}
