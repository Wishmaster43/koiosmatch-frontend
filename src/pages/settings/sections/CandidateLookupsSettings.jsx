/**
 * CandidateLookupsSettings — manage the three candidate lookups (contract types,
 * funnel stages, statuses) that drive the 3-layer ATS model. CRUD + drag-reorder
 * against /settings/candidate-lookups/{type}. The `value` slug is immutable once
 * created (only label/colour/order/active change); a new item's slug is derived
 * from its label but can be overridden. Colours/labels are per-tenant.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Trash2, RefreshCw, Pencil } from 'lucide-react'
import api from '../../../lib/api'
import { DragList, ColorSwatch, ColorBadge } from '../components/SettingsControls'

const BASE = '/settings/candidate-lookups'
const TYPES = [
  { key: 'candidate_types', slug: 'candidate-types' },
  { key: 'funnel_types',    slug: 'funnel-types' },
  { key: 'statuses',        slug: 'statuses' },
]

// "Niet actief" → "niet_actief" — a stable English-ish slug suggestion.
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const unwrap = (res) => res?.data?.data ?? res?.data

function LookupBlock({ slug, title, subtitle, items, setItems }) {
  const { t } = useTranslation('settings')
  const [modal,    setModal]    = useState(null) // null | { mode, id?, value, label, color }
  const [busy,     setBusy]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  const openAdd  = ()   => setModal({ mode: 'add',  value: '', label: '', color: '#3B8FD4' })
  const openEdit = (it) => setModal({ mode: 'edit', id: it.id, value: it.value, label: it.label, color: it.color ?? '#6B7280' })

  const save = async () => {
    if (!modal.label.trim()) return
    setBusy(true)
    try {
      if (modal.mode === 'add') {
        const value = modal.value.trim() || slugify(modal.label)
        const created = unwrap(await api.post(`${BASE}/${slug}`, { value, label: modal.label.trim(), color: modal.color }))
        setItems(p => [...p, created])
      } else {
        await api.put(`${BASE}/${slug}/${modal.id}`, { label: modal.label.trim(), color: modal.color })
        setItems(p => p.map(x => x.id === modal.id ? { ...x, label: modal.label.trim(), color: modal.color } : x))
      }
      setModal(null)
    } catch { /* noop */ } finally { setBusy(false) }
  }

  const updateColor = async (it, color) => {
    setItems(p => p.map(x => x.id === it.id ? { ...x, color } : x))
    try { await api.put(`${BASE}/${slug}/${it.id}`, { label: it.label, color }) } catch { /* noop */ }
  }

  // An item is protected when the backend marks it as referenced by existing data.
  const inUse = (i) => Boolean(i.in_use ?? i.is_used ?? i.locked ?? ((i.usage_count ?? i.candidates_count ?? 0) > 0))

  const remove = async (it) => {
    if (inUse(it)) return
    if (!confirm(t('lookups.confirmDelete', { name: it.label }))) return
    setDeleting(it.id)
    // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
    try { await api.delete(`${BASE}/${slug}/${it.id}`); setItems(p => p.filter(x => x.id !== it.id)) }
    catch (e) {
      if (e?.response?.status === 409) setItems(p => p.map(x => x.id === it.id ? { ...x, in_use: true } : x))
    } finally { setDeleting(null) }
  }

  const reorder = async (next) => {
    setItems(next)
    try { await api.put(`${BASE}/${slug}/reorder`, { ids: next.map(x => x.id) }) } catch { /* noop */ }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</h3>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{subtitle}</p>
        </div>
        <button onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB',
                   background: 'white', cursor: 'pointer', color: '#374151' }}>
          <Plus size={13} /> {t('lookups.add')}
        </button>
      </div>

      <DragList
        items={items}
        onReorder={reorder}
        renderItem={(item) => (
          <>
            <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />
            <ColorBadge label={item.label} color={item.color ?? '#6B7280'} />
            <code style={{ fontSize: 11, color: '#9CA3AF' }}>{item.value}</code>
            <div style={{ flex: 1 }} />
            <button onClick={() => openEdit(item)} title={t('lookups.edit')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#6B7280' }}>
              <Pencil size={11} />
            </button>
            <button onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
              title={inUse(item) ? t('lookups.inUse') : undefined}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: '#FEF2F2', border: 'none', borderRadius: 6, color: 'var(--color-danger)',
                       cursor: inUse(item) ? 'not-allowed' : 'pointer', opacity: inUse(item) ? 0.4 : 1 }}>
              {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>
          </>
        )}
      />
      {items.length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>{t('lookups.empty')}</p>}

      {modal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setModal(null)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{modal.mode === 'add' ? t('lookups.add') : t('lookups.edit')}</span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('lookups.labelField')}</div>
              <input value={modal.label} autoFocus onChange={e => setModal(m => ({ ...m, label: e.target.value }))}
                placeholder={t('lookups.labelPlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('lookups.valueField')}</div>
              <input value={modal.mode === 'add' ? modal.value : modal.value}
                disabled={modal.mode === 'edit'}
                onChange={e => setModal(m => ({ ...m, value: e.target.value }))}
                placeholder={modal.label ? slugify(modal.label) : 'slug'}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, fontFamily: 'monospace',
                         border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                         background: modal.mode === 'edit' ? '#F9FAFB' : 'white', color: modal.mode === 'edit' ? '#9CA3AF' : '#111827' }} />
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                {modal.mode === 'edit' ? t('lookups.valueImmutable') : t('lookups.valueHint')}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('lookups.colorField')}</div>
              <ColorSwatch color={modal.color} onChange={c => setModal(m => ({ ...m, color: c }))} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={save} disabled={busy || !modal.label.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: modal.label.trim() ? 1 : 0.4 }}>
                {busy ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function CandidateLookupsSettings() {
  const { t } = useTranslation('settings')
  const [data,    setData]    = useState({ candidate_types: [], funnel_types: [], statuses: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(BASE)
      .then(r => {
        const d = unwrap(r) ?? {}
        setData({
          candidate_types: d.candidate_types ?? [],
          funnel_types:    d.funnel_types    ?? [],
          statuses:        d.statuses        ?? [],
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Returns a setItems(updater|value) bound to one lookup type.
  const setType = (key) => (updater) =>
    setData(prev => ({ ...prev, [key]: typeof updater === 'function' ? updater(prev[key]) : updater }))

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="mb-6">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{t('lookups.title')}</h2>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{t('lookups.subtitle')}</p>
      </div>

      {loading ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('common.loadingShort')}</p> : (
        TYPES.map(({ key, slug }) => (
          <LookupBlock
            key={key}
            slug={slug}
            title={t(`lookups.${key}.title`)}
            subtitle={t(`lookups.${key}.subtitle`)}
            items={data[key]}
            setItems={setType(key)}
          />
        ))
      )}
    </div>
  )
}
