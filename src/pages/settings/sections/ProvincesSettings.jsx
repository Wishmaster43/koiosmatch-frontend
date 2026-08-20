/**
 * ProvincesSettings (PROVINCES-1) — tenant-editable region lookup, scoped per
 * country (Province model: country + name + position + active; candidates store
 * the plain name string via `useProvinces`). A BESPOKE screen rather than the
 * shared StatusListEditor: that editor's endpoint contract only ever appends
 * `/{id}` on writes and has no notion of a country query param, while provinces
 * need a country PICKER on top and `country` in the POST body — forcing that
 * concept onto the shared editor for its one user here would be worse than a
 * small screen that mirrors its look (row styling, drag-reorder via the shared
 * DragList, in-use-protected delete, add/edit modal) without duplicating it.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Save, X, Trash2, RefreshCw, Pencil, Plus } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { DragList } from '../components/SettingsControls'
import SearchSelect from '@/components/ui/SearchSelect'
import Spinner from '@/components/ui/Spinner'
import { useConfirm } from '@/hooks/useConfirm'
import { getCountryOptions } from '@/lib/countries'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import { PageTitle } from '@/components/ui/typography'

export default function ProvincesSettings() {
  const { t, i18n } = useTranslation('settings')
  const { confirm, dialog } = useConfirm()
  // ISO-3166 country list, localized to the active UI language (mirrors AddressCard).
  const countryOptions = getCountryOptions(i18n.language)

  const [country, setCountry] = useState('NL')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null) // null = create; item = edit
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(null)

  // Fetch the selected country's provinces. An alive guard drops a stale response
  // when the country switches (or the component unmounts) before it lands (§9).
  // `reloadKey` lets the retry button re-run the same effect without duplicating it.
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    api.get('/provinces', { params: { country } })
      .then(r => { if (alive) setItems(unwrapList(r).rows) })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [country, reloadKey])
  const retry = useCallback(() => setReloadKey(k => k + 1), [])

  // Open the modal blank (create) or prefilled with an existing row (edit).
  const openCreate = () => { setEditing(null); setName(''); setShowModal(true) }
  const openEdit = (item) => { setEditing(item); setName(item.name); setShowModal(true) }

  // One submit for both create (POST, carries the selected country) and edit
  // (PUT, name only — the backend keeps the row's own country untouched).
  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const res = await api.put(`/provinces/${editing.id}`, { name })
        const updated = unwrap(res) ?? { ...editing, name }
        setItems(p => p.map(x => x.id === editing.id ? { ...x, ...updated } : x))
      } else {
        const res = await api.post('/provinces', { country, name })
        setItems(p => [...p, unwrap(res)])
      }
      setShowModal(false); setName(''); setEditing(null)
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  // Delete behind the shared confirm dialog; a 409 means a candidate still
  // carries this province name — keep the row and flag it instead of a silent no-op.
  const remove = (item) => {
    if (item.in_use) return
    confirm(t('statusList.confirmDelete', { name: item.name }), async () => {
      setDeleting(item.id)
      try {
        await api.delete(`/provinces/${item.id}`)
        setItems(p => p.filter(x => x.id !== item.id))
      } catch (e) {
        if (e?.response?.status === 409) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
        else notifyError(t('statusList.deleteFailed'))
      } finally { setDeleting(null) }
    }, { danger: true })
  }

  // Persist the drag-reordered position within the current country only — the
  // list only ever holds that country's rows, so other countries stay untouched.
  const saveOrder = async () => {
    setSaving(true)
    try {
      await api.put('/provinces/reorder', { ids: items.map(x => x.id) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <PageTitle>{t('provinces.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('provinces.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {/* SaveButton — the ONE saved-state save action (§4 success token pair). */}
          <SaveButton saved={saved} onClick={saveOrder} disabled={saving}>
            {saved ? <><Check size={13}/> {t('common.saved')}</> : <><Save size={13}/> {t('common.save')}</>}
          </SaveButton>
          <Button variant="soft" onClick={openCreate}>
            <Plus size={14} /> {t('provinces.add')}
          </Button>
        </div>
      </div>

      {/* Country picker — the list below always shows THIS country's provinces. */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('provinces.country')}</div>
        <SearchSelect closeOnToggle width={280}
          options={countryOptions}
          selected={[country]}
          onToggle={next => { if (next !== country) setCountry(next) }}
          triggerLabel={countryOptions.find(o => o.value === country)?.label ?? country} />
      </div>

      {loading ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p> : loadError ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', fontSize: 13 }}>
            <AlertTriangle size={14} /> {t('provinces.loadError')}
          </div>
          <Button variant="secondary" onClick={retry}>
            <RefreshCw size={13} /> {t('provinces.retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('provinces.empty')}</p>
      ) : (
        <DragList
          items={items}
          onReorder={setItems}
          renderItem={(item) => (
            <>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.name}</span>
              <div style={{ flex: 1 }} />
              <Button variant="secondary" iconOnly onClick={() => openEdit(item)} title={t('statusList.edit')} aria-label={t('statusList.edit')}>
                <Pencil size={11} />
              </Button>
              {/* Delete is disabled when the item is still referenced by a candidate.
                  Accessible name stays the plain "delete" verb even while disabled —
                  title carries the in-use reason as a tooltip, aria-label never goes
                  undefined (VAC-CLEAR-style regression: name must survive both states). */}
              <Button variant="dangerSoft" iconOnly onClick={() => remove(item)} disabled={deleting === item.id || item.in_use}
                title={item.in_use ? t('statusList.inUse') : undefined} aria-label={t('common:delete')}>
                {deleting === item.id ? <Spinner size={11} /> : <Trash2 size={11} />}
              </Button>
            </>
          )}
        />
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 400, boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <PageTitle style={{ fontWeight: 700 }}>{editing ? t('statusList.editTitle') : t('provinces.add')}</PageTitle>
              <Button variant="ghost" iconOnly onClick={() => setShowModal(false)} aria-label={t('common.close')}><X size={16} /></Button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="province-name" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.nameLabel')}</label>
              <input id="province-name" value={name} onChange={e => setName(e.target.value)}
                placeholder={t('statusList.namePlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <Button variant="secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={submit} disabled={saving || !name.trim()}>
                {saving ? t('common.saving') : (editing ? t('common.save') : t('statusList.addBtn'))}
              </Button>
            </div>
          </div>
        </>
      )}

      {dialog}
    </div>
  )
}
