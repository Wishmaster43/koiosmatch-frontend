/**
 * StatusListEditor — generic CRUD list with drag-reorder and optional colour, used
 * by the Phases / Candidate status / Vacancy / Rejection sections. The section
 * passes its own title/subtitle/addLabel + endpoint; internal labels are translated.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save, Plus, X, Trash2, RefreshCw, Pencil } from 'lucide-react'
import api from '@/lib/api'
import { DragList, ColorSwatch, ColorBadge } from '../components/SettingsControls'

// extraField (optioneel): { key, label, options: [{value,label}], default } —
// rendert een extra keuzeveld in de aanmaak-modal + een badge in de rij.
export default function StatusListEditor({ title, subtitle, endpoint, addLabel, withColor = true, withSave = true, compact = false, extraField = null }) {
  const { t } = useTranslation('settings')
  const emptyDraft = () => ({ name: '', color: '#3B8FD4', ...(extraField ? { [extraField.key]: extraField.default } : {}) })
  // Lookups differ in their display field: name (phases/status) vs label/value (genders/languages).
  const labelOf = (i) => i.name ?? i.label ?? i.value ?? ''
  // An item is protected when the backend marks it as referenced by existing data.
  const inUse = (i) => Boolean(i.in_use ?? i.is_used ?? i.locked ?? ((i.usage_count ?? i.candidates_count ?? 0) > 0))
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)   // null = create; item = edit
  const [draft,     setDraft]     = useState(emptyDraft)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [deleting,  setDeleting]  = useState(null)

  useEffect(() => {
    api.get(endpoint).then(r => setItems(r.data?.data ?? r.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [endpoint])

  // Open the modal blank (create) or prefilled with an existing item (edit).
  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setShowModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    setDraft({ name: labelOf(item), color: item.color ?? '#3B8FD4',
      ...(extraField ? { [extraField.key]: item[extraField.key] ?? extraField.default } : {}) })
    setShowModal(true)
  }

  // One submit for both create (POST) and edit (PUT). Send name + label so both
  // name-based and label/value-based lookups accept it.
  const submit = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    const body = { ...draft, label: draft.name }
    try {
      if (editing) {
        const res = await api.put(`${endpoint}/${editing.id}`, { ...editing, ...body })
        const updated = res.data?.data ?? res.data ?? { ...editing, ...body }
        setItems(p => p.map(x => x.id === editing.id ? { ...x, ...updated } : x))
      } else {
        const res = await api.post(endpoint, body)
        setItems(p => [...p, res.data?.data ?? res.data])
      }
      setShowModal(false); setDraft(emptyDraft()); setEditing(null)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  const remove = async (item) => {
    if (inUse(item)) return
    if (!confirm(t('statusList.confirmDelete', { name: labelOf(item) }))) return
    setDeleting(item.id)
    // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
    try { await api.delete(`${endpoint}/${item.id}`); setItems(p => p.filter(x => x.id !== item.id)) }
    catch (e) {
      if (e?.response?.status === 409) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
    } finally { setDeleting(null) }
  }

  const updateColor = async (item, color) => {
    setItems(p => p.map(x => x.id === item.id ? { ...x, color } : x))
    try { await api.put(`${endpoint}/${item.id}`, { ...item, color }) } catch { /* noop */ }
  }

  const saveOrder = async () => {
    setSaving(true)
    try {
      await api.put(`${endpoint}/reorder`, { ids: items.map(x => x.id) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          {compact
            ? <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
            : <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {withSave && (
            <button onClick={saveOrder} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                       fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                       whiteSpace: 'nowrap', flexShrink: 0,
                       background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
              {saved ? <><Check size={13}/> {t('common.saved')}</> : <><Save size={13}/> {t('common.save')}</>}
            </button>
          )}
          <button onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
                     whiteSpace: 'nowrap', flexShrink: 0,
                     background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            <Plus size={13} /> {addLabel}
          </button>
        </div>
      </div>

      {loading ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p> : (
        <DragList
          items={items}
          onReorder={setItems}
          renderItem={(item) => (
            <>
              {withColor && <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />}
              {withColor
                ? <ColorBadge label={labelOf(item)} color={item.color ?? '#6B7280'} />
                : <span style={{ fontSize: 13, color: 'var(--text)' }}>{labelOf(item)}</span>}
              {extraField && item[extraField.key] && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                  {extraField.options.find(o => o.value === item[extraField.key])?.label ?? item[extraField.key]}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => openEdit(item)} title={t('statusList.edit')}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: 'var(--border)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>
                <Pencil size={11} />
              </button>
              {/* Delete is disabled when the item is still referenced by existing data. */}
              <button onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
                title={inUse(item) ? t('statusList.inUse') : undefined}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: 'var(--color-danger-bg)', border: 'none', borderRadius: 6, color: 'var(--color-danger)',
                         cursor: inUse(item) ? 'not-allowed' : 'pointer', opacity: inUse(item) ? 0.4 : 1 }}>
                {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </>
          )}
        />
      )}

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
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder={t('statusList.namePlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {withColor && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.colorLabel')}</div>
                <ColorSwatch color={draft.color} onChange={c => setDraft(d => ({ ...d, color: c }))} />
              </div>
            )}
            {extraField && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{extraField.label}</div>
                <select value={draft[extraField.key]} onChange={e => setDraft(d => ({ ...d, [extraField.key]: e.target.value }))}
                  style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)' }}>
                  {extraField.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
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
    </div>
  )
}
