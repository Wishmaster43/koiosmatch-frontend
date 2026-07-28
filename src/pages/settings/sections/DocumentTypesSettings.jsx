import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Trash2, RefreshCw, Pencil, AlertTriangle, Check, Save } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { DragList, ColorSwatch, ColorBadge } from '../components/SettingsControls'
import IconPickerControl from './IconPickerControl'
import SubTabBar from '@/components/drawer/SubTabBar'
import { resolveDocTypeIcon, DOC_TYPE_ICON_NAMES } from '@/lib/useDocumentTypes'
import { BTN_H } from '@/config/buttonMetrics'

const ENDPOINT = '/document-types'
// V20b entity scope (backend CandidateDocumentType::ENTITIES) — tab order.
const ENTITIES = ['candidate', 'vacancy', 'customer']
// Reuse the nav labels already shipped for the custom-fields sub-tabs (mirrors
// NoteTypesSettings' ENTITY_NAV_ID) — one translated label per entity, no new key.
const ENTITY_NAV_ID = { candidate: 'cf_candidate', vacancy: 'cf_vacancy', customer: 'cf_customer' }

/**
 * Document types — categorisation + colour + icon of documents (CV, ID, …), split
 * into one sub-tab PER OWNING ENTITY (Kandidaat/Vacature/Klant), mirroring
 * CandidateLookupsSettings' sub-tab split and the note-types entity pattern
 * (backend V20b: CandidateDocumentType::ENTITIES = candidate/vacancy/customer).
 *
 * A type's `entity` column is NULL for "applies to every entity" (the note-types
 * "global" convention). The backend's GET already folds those rows into every
 * entity's response (`?entity=X` → WHERE entity=X OR entity IS NULL), so a Global
 * type shows on all three tabs — marked with a soft chip so deleting/renaming it
 * from one tab is never a silent surprise on the others.
 *
 * DELIBERATE CHOICE: editing an existing row (via the modal, or the in-row colour/
 * icon quick-edits) never sends `entity` in the request body, on any tab — the
 * backend's `entity` validation rule is `sometimes`, so an omitted key leaves the
 * stored column untouched. Only CREATE sends the active tab's `entity`, since a
 * brand-new type has to start somewhere. This is what keeps a Global row Global
 * even when it is renamed/recoloured from inside one entity's tab.
 *
 * Bespoke CRUD here (not the shared StatusListEditor): StatusListEditor's single
 * `entity` prop sends that same entity on EVERY submit, including edits — correct
 * for note-types (which have no cross-entity "global" overlap to protect), wrong
 * for this lookup's global rows.
 */
export default function DocumentTypesSettings() {
  const { t } = useTranslation('settings')
  const [activeEntity, setActiveEntity] = useState(ENTITIES[0])
  const tabs = ENTITIES.map(e => ({ id: e, label: t(`nav.${ENTITY_NAV_ID[e]}`) }))

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('documentTypes.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>{t('documentTypes.subtitle')}</p>

      <SubTabBar tabs={tabs} active={activeEntity} onChange={setActiveEntity} />
      <div style={{ marginTop: 14 }}>
        {/* key=entity forces a full remount per tab switch — no stale items/modal/
            saved-flag state leaking from the previous tab (simpler and safer than
            manually resetting every piece of state on every entity change). */}
        <DocumentTypeList key={activeEntity} entity={activeEntity} addLabel={t('documentTypes.add')} />
      </div>
    </div>
  )
}

// One tab's list: this entity's own types PLUS the global (entity=null) ones,
// exactly as the backend's `?entity=X` contract returns them.
function DocumentTypeList({ entity, addLabel }) {
  const { t } = useTranslation('settings')
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null) // null = create; item = edit
  // eslint-disable-next-line no-restricted-syntax -- DATA: default swatch colour pre-filled for a new row, not UI chrome
  const [draft,     setDraft]     = useState({ name: '', color: '#3B8FD4' })
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [deleting,  setDeleting]  = useState(null)
  const { confirm, dialog } = useConfirm()

  // Fetch this tab's slice on mount; an alive guard drops a late response if the
  // component unmounts (tab switch) before it resolves.
  useEffect(() => {
    let alive = true
    api.get(ENDPOINT, { params: { entity } })
      .then(r => { if (alive) setItems(unwrapList(r).rows) })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [entity])

  // A Global row (entity=null) applies to every tab — see the file header.
  const isGlobal = (item) => item.entity == null
  const inUse = (item) => Boolean(item.in_use)

  const openCreate = () => {
    setEditing(null)
    // eslint-disable-next-line no-restricted-syntax -- DATA: default swatch colour pre-filled for a new row, not UI chrome
    setDraft({ name: '', color: '#3B8FD4' })
    setShowModal(true)
  }
  const openEdit = (item) => {
    setEditing(item)
    // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a row without one stored yet, not UI chrome
    setDraft({ name: item.name ?? '', color: item.color ?? '#6B7280' })
    setShowModal(true)
  }

  // CREATE sends this tab's entity. EDIT never sends `entity` (see file header's
  // DELIBERATE CHOICE) — so renaming/recolouring a Global row from any tab can
  // never narrow its scope.
  const submit = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    const body = { name: draft.name.trim(), color: draft.color }
    try {
      if (editing) {
        const res = await api.put(`${ENDPOINT}/${editing.id}`, body)
        const updated = unwrap(res) ?? { ...editing, ...body }
        setItems(p => p.map(x => x.id === editing.id ? { ...x, ...updated } : x))
      } else {
        const res = await api.post(ENDPOINT, { ...body, entity })
        setItems(p => [...p, unwrap(res)])
      }
      setShowModal(false)
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  // Same "never send entity" rule for the in-row colour/icon quick-edits.
  const updateColor = async (item, color) => {
    const previous = items
    setItems(p => p.map(x => x.id === item.id ? { ...x, color } : x))
    try { await api.put(`${ENDPOINT}/${item.id}`, { name: item.name, color }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }
  const updateIcon = async (item, icon) => {
    const previous = items
    setItems(p => p.map(x => x.id === item.id ? { ...x, icon } : x))
    try { await api.put(`${ENDPOINT}/${item.id}`, { name: item.name, icon }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  const remove = (item) => {
    if (inUse(item)) return
    confirm(t('statusList.confirmDelete', { name: item.name }), async () => {
      setDeleting(item.id)
      // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
      try { await api.delete(`${ENDPOINT}/${item.id}`); setItems(p => p.filter(x => x.id !== item.id)) }
      catch (e) {
        if (e?.response?.status === 409) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
        else notifyError(t('statusList.deleteFailed'))
      } finally { setDeleting(null) }
    }, { danger: true })
  }

  // Local reorder only — the Save button below persists it (mirrors StatusListEditor).
  const saveOrder = async () => {
    setSaving(true)
    try {
      await api.put(`${ENDPOINT}/reorder`, { ids: items.map(x => x.id) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', fontSize: 13, padding: '8px 0' }}>
        <AlertTriangle size={14} /> {t('statusList.loadError')}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end" style={{ marginBottom: 12, gap: 8 }}>
        <button onClick={saveOrder} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                   background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
          {saved ? <><Check size={13}/> {t('common.saved')}</> : <><Save size={13}/> {t('common.save')}</>}
        </button>
        <button onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
                   background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          <Plus size={13} /> {addLabel}
        </button>
      </div>

      {loading ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p> : (
        <DragList items={items} onReorder={setItems} renderItem={(item) => (
          <>
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a row without one stored yet, not UI chrome */}
            <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />
            <IconPickerControl icons={DOC_TYPE_ICON_NAMES} resolve={resolveDocTypeIcon} value={item.icon}
              // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a row without one stored yet, not UI chrome
              color={item.color ?? '#6B7280'} label={item.name} onPick={icon => updateIcon(item, icon)} />
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a row without one stored yet, not UI chrome */}
            <ColorBadge label={item.name} color={item.color ?? '#6B7280'} />
            {/* Global marker (entity=null, applies to every tab) — soft chip, house
                convention (§4): tinted background/border, never a solid fill. */}
            {isGlobal(item) && (
              <span title={t('documentTypes.globalBadge', { defaultValue: 'Global' })}
                style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: 999,
                         color: 'var(--color-info)', background: 'color-mix(in srgb, var(--color-info) 12%, transparent)',
                         border: '1px solid color-mix(in srgb, var(--color-info) 32%, transparent)' }}>
                {t('documentTypes.globalBadge', { defaultValue: 'Global' })}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={() => openEdit(item)} title={t('statusList.edit')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'var(--border)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>
              <Pencil size={11} />
            </button>
            <button onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
              title={inUse(item) ? t('statusList.inUse') : undefined}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'var(--color-danger-bg)', border: 'none', borderRadius: 6, color: 'var(--color-danger)',
                       cursor: inUse(item) ? 'not-allowed' : 'pointer', opacity: inUse(item) ? 0.4 : 1 }}>
              {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>
          </>
        )} />
      )}
      {!loading && items.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('lookups.empty')}</p>}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{editing ? t('statusList.editTitle') : addLabel}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.nameLabel')}</div>
              <input value={draft.name} autoFocus onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder={t('statusList.namePlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.colorLabel')}</div>
              <ColorSwatch color={draft.color} onChange={c => setDraft(d => ({ ...d, color: c }))} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={submit} disabled={saving || !draft.name.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: draft.name.trim() ? 1 : 0.4 }}>
                {saving ? t('common.saving') : (editing ? t('common.save') : t('statusList.addBtn'))}
              </button>
            </div>
          </div>
        </>
      )}
      {dialog}
    </div>
  )
}
