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
import api, { unwrap, unwrapList } from '@/lib/api'
import { useCustomFields, type CustomFieldEntityType } from '@/lib/useCustomFields'
import { notifyError } from '@/lib/notify'
import { DragList } from '../components/SettingsControls'
import { PageTitle } from '@/components/ui/typography'
import AddCardTrigger from '@/components/ui/AddCardTrigger'
import type { CustomField, CustomFieldDef, EditForm, NewFieldForm } from './customfields/types'
import { ENTITY_NAV_ID, toSlug, toField } from './customfields/helpers'
import CustomFieldRow from './customfields/CustomFieldRow'
import NewFieldCard from './customfields/NewFieldCard'

// Props: which entity's custom-field set this tab renders (candidate/vacancy/…).
interface CustomFieldsSettingsProps {
  entityType: CustomFieldEntityType
}

// See the file's top doc above; the one custom-fields CRUD editor, parameterized per entity type.
export default function CustomFieldsSettings({ entityType }: CustomFieldsSettingsProps) {
  const { t, i18n } = useTranslation('settings')
  const { invalidate } = useCustomFields(entityType)
  const entityLabel = t(`nav.${ENTITY_NAV_ID[entityType] ?? entityType}`)
  const [fields,   setFields]   = useState<CustomField[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [newForm,  setNewForm]  = useState<NewFieldForm>({ label: '', key: '', type: 'text', options: '', optionError: false })
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({})

  // Load definitions whenever the entity or language changes (unified /custom-fields).
  // An alive guard stops a stale response from a previous entity tab overwriting a newer one.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    api.get('/custom-fields', { params: { entity_type: entityType } })
      .then(r => { if (alive) setFields(unwrapList<CustomFieldDef>(r).rows.map(d => toField(d, i18n.language))) })
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
  const reorder = async (next: CustomField[]) => {
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
  const toggleActive = async (field: CustomField) => {
    const patched = { ...field, active: !field.active }
    setFields(p => p.map(f => f.id === field.id ? patched : f))
    await api.patch(`/custom-fields/${field.id}`, { active: patched.active })
      .then(() => invalidate())
      .catch(() => { setFields(p => p.map(f => f.id === field.id ? field : f)); notifyError(t('statusList.saveFailed')) })
  }

  // Worklist #44: toggle visible_in_ui without opening the full edit card — the
  // field stays active/writable via the API either way, this only hides it from
  // the entity's Extra tab. Optimistic with rollback on failure, then invalidate
  // so every open drawer's gated tab list refetches the new state.
  const toggleVisibleInUi = async (field: CustomField) => {
    const patched = { ...field, visible_in_ui: !field.visible_in_ui }
    setFields(p => p.map(f => f.id === field.id ? patched : f))
    await api.patch(`/custom-fields/${field.id}`, { visible_in_ui: patched.visible_in_ui })
      .then(() => invalidate())
      .catch(() => { setFields(p => p.map(f => f.id === field.id ? field : f)); notifyError(t('statusList.saveFailed')) })
  }

  // Create a new field.
  const handleCreate = async () => {
    const label = newForm.label.trim()
    if (!label) return
    // Client-side validation: select type requires at least one option.
    if (newForm.type === 'select') {
      const opts = newForm.options.split(',').map(s => s.trim()).filter(Boolean)
      if (opts.length === 0) {
        setNewForm(p => ({ ...p, optionError: true }))
        return
      }
    }
    setSaving('new')
    try {
      const payload: Record<string, unknown> = {
        entity_type: entityType,
        key:   newForm.key.trim() || toSlug(label),
        label_i18n: { en: label, [i18n.language]: label },
        type:  newForm.type,
      }
      // Include options ONLY for select type.
      if (newForm.type === 'select') {
        payload.options = newForm.options.split(',').map(s => s.trim()).filter(Boolean)
      }
      const res = await api.post('/custom-fields', payload)
      const d = unwrap<CustomFieldDef>(res)
      setFields(p => [...p, toField(d, i18n.language)])
      setNewForm({ label: '', key: '', type: 'text', options: '', optionError: false })
      setAdding(false)
      invalidate()
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(null) }
  }

  // Save edits to an existing field.
  const handleSave = async (field: CustomField) => {
    const form = editForms[field.id] ?? {}
    const effectiveType = form.type ?? field.type
    // Client-side validation: select type requires at least one option.
    if (effectiveType === 'select') {
      const opts = (form.options ?? (field.options ?? []).join(', ')).split(',').map(s => s.trim()).filter(Boolean)
      if (opts.length === 0) {
        setEditForms(p => ({ ...p, [field.id]: { ...(p[field.id] ?? {}), optionError: true } }))
        return
      }
    }
    setSaving(field.id)
    try {
      const newLabel = form.label ?? field.label
      const payload: Record<string, unknown> = {
        label_i18n: { ...(field.label_i18n ?? {}), [i18n.language]: newLabel },
        active:  form.active ?? field.active,
      }
      // Include options ONLY for select type.
      if (effectiveType === 'select') {
        payload.options = (form.options ?? (field.options ?? []).join(', ')).split(',').map(s => s.trim()).filter(Boolean)
      }
      if (!field.has_data) payload.type = effectiveType
      const res = await api.patch(`/custom-fields/${field.id}`, payload)
      const d = unwrap<CustomFieldDef>(res)
      setFields(p => p.map(f => f.id === field.id ? toField(d, i18n.language) : f))
      setExpanded(null)
      invalidate()
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(null) }
  }

  // Delete — blocked if has_data (409 from backend or has_data flag on item).
  const handleDelete = async (field: CustomField) => {
    if (field.has_data) return
    setSaving(field.id)
    try {
      await api.delete(`/custom-fields/${field.id}`)
      setFields(p => p.filter(f => f.id !== field.id))
      if (expanded === field.id) setExpanded(null)
      invalidate()
    } catch (e) {
      if ((e as { response?: { status?: number } })?.response?.status === 409) setFields(p => p.map(f => f.id === field.id ? { ...f, has_data: true } : f))
    } finally { setSaving(null) }
  }

  const setEF = (id: string, k: keyof EditForm, v: EditForm[keyof EditForm]) => setEditForms(p => ({ ...p, [id]: { ...(p[id] ?? {}), [k]: v } }))

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
        renderItem={(field: CustomField) => (
          <CustomFieldRow
            field={field}
            isOpen={expanded === field.id}
            ef={editForms[field.id] ?? {}}
            saving={saving === field.id}
            onToggleActive={() => toggleActive(field)}
            onToggleVisible={() => toggleVisibleInUi(field)}
            onToggleOpen={() => setExpanded(expanded === field.id ? null : field.id)}
            onClose={() => setExpanded(null)}
            onEdit={(k, v) => setEF(field.id, k, v)}
            onSave={() => handleSave(field)}
            onDelete={() => handleDelete(field)}
          />
        )}
      />

      {/* Add new field */}
      {adding ? (
        <NewFieldCard newForm={newForm} onChange={setNewForm} saving={saving === 'new'} onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      ) : (
        <AddCardTrigger onClick={() => setAdding(true)} label={t('customFieldsSettings.add')} />
      )}
    </div>
  )
}
