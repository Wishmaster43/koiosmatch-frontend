/**
 * StatusListEditor — generic CRUD list with drag-reorder and optional colour, used
 * by the Phases / Candidate status / Vacancy / Rejection sections. The section
 * passes its own title/subtitle/addLabel + endpoint; internal labels are translated.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save, Plus, X, Trash2, RefreshCw } from 'lucide-react'
import api from '../../../lib/api'
import { DragList, ColorSwatch, ColorBadge } from '../components/SettingsControls'

export default function StatusListEditor({ title, subtitle, endpoint, addLabel, withColor = true, withSave = true, compact = false }) {
  const { t } = useTranslation('settings')
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [draft,     setDraft]     = useState({ name: '', color: '#3B8FD4' })
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [deleting,  setDeleting]  = useState(null)

  useEffect(() => {
    api.get(endpoint).then(r => setItems(r.data?.data ?? r.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [endpoint])

  const create = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      const res = await api.post(endpoint, draft)
      setItems(p => [...p, res.data])
      setShowModal(false); setDraft({ name: '', color: '#3B8FD4' })
    } catch { /* noop */ } finally { setSaving(false) }
  }

  const remove = async (item) => {
    if (!confirm(t('statusList.confirmDelete', { name: item.name }))) return
    setDeleting(item.id)
    try { await api.delete(`${endpoint}/${item.id}`); setItems(p => p.filter(x => x.id !== item.id)) }
    catch { /* noop */ } finally { setDeleting(null) }
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
            ? <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</h3>
            : <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{title}</h2>}
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{subtitle}</p>
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
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB',
                     whiteSpace: 'nowrap', flexShrink: 0,
                     background: 'white', cursor: 'pointer', color: '#374151' }}>
            <Plus size={13} /> {addLabel}
          </button>
        </div>
      </div>

      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('common.loadingShort')}</p> : (
        <DragList
          items={items}
          onReorder={setItems}
          renderItem={(item) => (
            <>
              {withColor && <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />}
              {withColor
                ? <ColorBadge label={item.name} color={item.color ?? '#6B7280'} />
                : <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>{item.name}</span>}
              <div style={{ flex: 1 }} />
              <button onClick={() => remove(item)} disabled={deleting === item.id}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: '#FEF2F2', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--color-danger)' }}>
                {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </>
          )}
        />
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{addLabel}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('statusList.nameLabel')}</div>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder={t('statusList.namePlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {withColor && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('statusList.colorLabel')}</div>
                <ColorSwatch color={draft.color} onChange={c => setDraft(d => ({ ...d, color: c }))} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={create} disabled={saving || !draft.name.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: draft.name.trim() ? 1 : 0.4 }}>
                {saving ? t('common.saving') : t('statusList.addBtn')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
